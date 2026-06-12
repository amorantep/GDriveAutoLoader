"""
GDrive AutoLoader — FastAPI backend.
Serves the static UI and exposes all API endpoints for auth, file listing,
Drive folder browsing, upload job management, and report export.
"""

import asyncio
import csv
import io
import json
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from googleapiclient.discovery import build
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import auth
from uploader import jobs, run_upload_job, get_existing_drive_files

load_dotenv()

REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
DEFAULT_DELAY_MS = int(os.getenv("DEFAULT_UPLOAD_DELAY_MS", "500"))

app = FastAPI(title="GDrive AutoLoader", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (the frontend)
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Thread pool for blocking upload jobs
_executor = ThreadPoolExecutor(max_workers=4)

# OAuth state store: state_token -> True  (simple CSRF protection)
_oauth_states: Dict[str, bool] = {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class FileListRequest(BaseModel):
    path: str
    sort_by: str = "name"   # name | created | modified | type | size
    sort_dir: str = "asc"   # asc | desc


class UploadStartRequest(BaseModel):
    files: List[str]          # absolute local paths
    destination_folder_id: str
    delay_ms: int = DEFAULT_DELAY_MS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_drive_service():
    creds = auth.get_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in first.")
    return build("drive", "v3", credentials=creds)


_DATE_PATTERNS = [
    re.compile(r"(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})"),  # YYYY-MM-DD or YYYYMMDD
]


def _extract_date_from_name(name: str) -> Optional[str]:
    """Try to extract a YYYY-MM-DD sort key from a filename."""
    stem = Path(name).stem
    for pat in _DATE_PATTERNS:
        m = pat.search(stem)
        if m:
            return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def _file_sort_key(file_info: Dict[str, Any], sort_by: str):
    """Return a comparable sort key for a file metadata dict."""
    if sort_by == "name":
        date_key = _extract_date_from_name(file_info["name"])
        if date_key:
            return (0, date_key, file_info["name"].lower())
        return (1, "", file_info["name"].lower())
    if sort_by == "created":
        return file_info.get("created", 0)
    if sort_by == "modified":
        return file_info.get("modified", 0)
    if sort_by == "type":
        return file_info.get("extension", "").lower()
    if sort_by == "size":
        return file_info.get("size", 0)
    return file_info["name"].lower()


def _human_size(size_bytes: int) -> str:
    """Convert bytes to a human-readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"


def _collect_files(directory: str) -> List[Dict[str, Any]]:
    """Return a flat list of file metadata dicts for all direct children of directory."""
    base = Path(directory)
    if not base.exists():
        raise FileNotFoundError(f"Path does not exist: {directory}")
    if not base.is_dir():
        raise NotADirectoryError(f"Not a directory: {directory}")

    result = []
    for entry in base.iterdir():
        if not entry.is_file():
            continue
        try:
            stat = entry.stat()
        except OSError:
            continue
        size = stat.st_size
        result.append(
            {
                "name": entry.name,
                "path": str(entry.resolve()),
                "size": size,
                "size_human": _human_size(size),
                "created": stat.st_ctime,
                "created_iso": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
                "modified": stat.st_mtime,
                "modified_iso": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "extension": entry.suffix.lstrip(".").lower(),
            }
        )
    return result


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.get("/auth/login")
def auth_login():
    """Return the Google OAuth consent-screen URL for the frontend to navigate to."""
    try:
        auth_url, state = auth.start_oauth_flow(REDIRECT_URI)
        _oauth_states[state] = True
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"auth_url": auth_url}


@app.get("/auth/callback")
def auth_callback(code: str = Query(...), state: Optional[str] = Query(None)):
    """Handle the OAuth callback: exchange code for tokens, redirect to SPA."""
    # State validation (best-effort; state may be None for some flows)
    if state and state not in _oauth_states:
        raise HTTPException(status_code=400, detail="Invalid OAuth state. Possible CSRF attempt.")
    if state:
        del _oauth_states[state]

    try:
        auth.exchange_code(code, REDIRECT_URI, state=state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {e}")
    return RedirectResponse(url="/?auth=success")


@app.get("/auth/status")
def auth_status():
    return {"authenticated": auth.is_authenticated()}


@app.post("/auth/logout")
def auth_logout():
    auth.revoke_credentials()
    return {"ok": True}


# ---------------------------------------------------------------------------
# File listing endpoint
# ---------------------------------------------------------------------------


@app.post("/files/list")
def files_list(req: FileListRequest):
    """List files in a local directory with sorting."""
    try:
        files = _collect_files(req.path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except NotADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    reverse = req.sort_dir.lower() == "desc"
    files.sort(key=lambda f: _file_sort_key(f, req.sort_by), reverse=reverse)

    return {"files": files, "count": len(files)}


# ---------------------------------------------------------------------------
# Drive folder endpoints
# ---------------------------------------------------------------------------


@app.get("/drive/folders")
def drive_folders(parent_id: str = Query("root")):
    """
    List Drive folders inside a given parent (default: root).
    Returns a flat list suitable for a simple folder picker.
    """
    service = _get_drive_service()

    query = (
        f"'{parent_id}' in parents "
        "and mimeType = 'application/vnd.google-apps.folder' "
        "and trashed = false"
    )
    try:
        response = (
            service.files()
            .list(
                q=query,
                fields="files(id, name, parents)",
                orderBy="name",
                pageSize=200,
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    folders = response.get("files", [])
    return {"folders": folders, "parent_id": parent_id}


# ---------------------------------------------------------------------------
# Upload endpoints
# ---------------------------------------------------------------------------


@app.post("/upload/start")
def upload_start(req: UploadStartRequest, background_tasks: BackgroundTasks):
    """
    Kick off an upload job in a background task.
    Returns a job_id that the client uses to poll /upload/progress/{job_id}.
    """
    if not auth.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated.")

    for fp in req.files:
        if not Path(fp).is_file():
            raise HTTPException(status_code=400, detail=f"File not found: {fp}")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "total": len(req.files),
        "index": 0,
        "current_file": "",
        "events": [],
        "report": [],
        "error": "",
    }

    def _run():
        service = _get_drive_service()
        run_upload_job(
            job_id=job_id,
            files=req.files,
            folder_id=req.destination_folder_id,
            delay_ms=req.delay_ms,
            service=service,
        )

    background_tasks.add_task(_run)
    return {"job_id": job_id}


@app.get("/upload/progress/{job_id}")
async def upload_progress(job_id: str):
    """
    SSE endpoint that streams progress events for the given job.
    Each 'progress' event is a JSON object with file, index, total, status, md5s, size, timestamp.
    A final 'done' event is sent when the job completes or fails.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_generator():
        last_sent = 0  # index into jobs[job_id]["events"] already streamed

        while True:
            job = jobs.get(job_id)
            if job is None:
                break

            events = job.get("events", [])
            while last_sent < len(events):
                evt = events[last_sent]
                yield {
                    "event": "progress",
                    "data": json.dumps(evt),
                }
                last_sent += 1

            if job["status"] in ("done", "failed"):
                yield {
                    "event": "done",
                    "data": json.dumps(
                        {
                            "status": job["status"],
                            "total": job["total"],
                            "error": job.get("error", ""),
                        }
                    ),
                }
                break

            await asyncio.sleep(0.3)

    return EventSourceResponse(event_generator())


@app.get("/upload/report/{job_id}")
def upload_report(job_id: str):
    """Return the full upload report as JSON."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "total": job["total"],
        "report": job["report"],
    }


@app.get("/upload/report/{job_id}/csv")
def upload_report_csv(job_id: str):
    """Return the upload report as a CSV file download."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = jobs[job_id]
    report = job["report"]

    output = io.StringIO()
    fieldnames = ["filename", "size", "local_md5", "drive_md5", "status", "timestamp", "error"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in report:
        writer.writerow(row)

    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="report_{job_id[:8]}.csv"'},
    )


# ---------------------------------------------------------------------------
# Root — serve the SPA
# ---------------------------------------------------------------------------


@app.get("/")
def root():
    index_path = static_dir / "index.html"
    if not index_path.exists():
        return Response("Frontend not found. Check static/index.html.", media_type="text/plain")
    return HTMLResponse(index_path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
