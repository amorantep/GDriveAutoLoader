"""
main.py - FastAPI application for GDrive AutoLoader.

Endpoints
  GET  /                              Serve static/index.html
  GET  /auth/login                    Start OAuth2 flow (redirect to Google)
  GET  /auth/callback                 OAuth2 callback
  GET  /auth/status                   {authenticated: bool}
  POST /files/list                    List local files with metadata
  GET  /drive/folders                 List Drive folders for destination picker
  POST /upload/start                  Start upload job, returns job_id
  GET  /upload/progress/{job_id}      SSE stream with progress events
  GET  /upload/report/{job_id}        Full report JSON
  GET  /upload/report/{job_id}/csv    Report as CSV download
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    RedirectResponse,
    StreamingResponse,
)
from pydantic import BaseModel

import auth
import uploader
from uploader import UploadJob

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="GDrive AutoLoader", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store  {job_id: UploadJob}
_jobs: Dict[str, UploadJob] = {}

STATIC_DIR = Path(__file__).parent / "static"

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class FileListRequest(BaseModel):
    path: str
    sort_by: str = "name"   # name | size | created | modified | mime
    sort_dir: str = "asc"   # asc | desc


class UploadStartRequest(BaseModel):
    files: List[Dict]
    destination_folder_id: str
    delay_ms: int = 500


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DATE_RE_DASHED = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
_DATE_RE_PLAIN  = re.compile(r"^(\d{8})")


def _smart_name_key(name: str) -> str:
    """
    Sort key for filenames.
    Names starting with YYYY-MM-DD or YYYYMMDD sort chronologically first.
    """
    m = _DATE_RE_DASHED.match(name)
    if m:
        return f"0_{m.group(1)}{m.group(2)}{m.group(3)}_{name.lower()}"
    m = _DATE_RE_PLAIN.match(name)
    if m:
        return f"0_{m.group(1)}_{name.lower()}"
    return f"1_{name.lower()}"


def _file_meta(p: Path) -> Dict:
    """Return a metadata dict for a local file."""
    stat = p.stat()
    import mimetypes
    mime, _ = mimetypes.guess_type(str(p))
    return {
        "name": p.name,
        "path": str(p),
        "size": stat.st_size,
        "mime": mime or "application/octet-stream",
        "created": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }


def _sort_key(item: Dict, sort_by: str):
    """Return a sort key for a file metadata dict."""
    if sort_by == "size":
        return item.get("size", 0)
    if sort_by in ("created", "modified"):
        return item.get(sort_by, "")
    if sort_by == "mime":
        return item.get("mime", "").lower()
    return _smart_name_key(item.get("name", ""))


def _get_redirect_uri(request: Request) -> str:
    """Build the OAuth redirect URI from env var or the incoming request."""
    env_uri = os.getenv("REDIRECT_URI", "").strip()
    if env_uri:
        return env_uri
    base = str(request.base_url).rstrip("/")
    return f"{base}/auth/callback"


# ---------------------------------------------------------------------------
# Routes — static
# ---------------------------------------------------------------------------


@app.get("/", include_in_schema=False)
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(str(index_path), media_type="text/html")


# ---------------------------------------------------------------------------
# Routes — auth
# ---------------------------------------------------------------------------


@app.get("/auth/login")
async def auth_login(request: Request):
    """Redirect the browser to Google's OAuth consent screen."""
    redirect_uri = _get_redirect_uri(request)
    try:
        authorization_url, _state = auth.start_auth_flow(redirect_uri)  # noqa: F841
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RedirectResponse(url=authorization_url)


@app.get("/auth/callback")
async def auth_callback(
    request: Request,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
):
    """Handle Google's OAuth callback, exchange code for tokens."""
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code parameter")

    redirect_uri = _get_redirect_uri(request)
    try:
        auth.handle_callback(code=code, redirect_uri=redirect_uri, state=state)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return RedirectResponse(url="/?auth=success")


@app.get("/auth/status")
async def auth_status():
    """Return whether the user is currently authenticated."""
    return {"authenticated": auth.is_authenticated()}


# ---------------------------------------------------------------------------
# Routes — local files
# ---------------------------------------------------------------------------


@app.post("/files/list")
async def files_list(body: FileListRequest):
    """List files in a local directory, returning metadata for each file."""
    folder = Path(body.path)
    if not folder.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {body.path}")
    if not folder.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {body.path}")

    files = []
    try:
        for entry in folder.iterdir():
            if entry.is_file():
                try:
                    files.append(_file_meta(entry))
                except OSError:
                    pass  # Skip files we can't stat
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    reverse = body.sort_dir.lower() == "desc"
    files.sort(key=lambda x: _sort_key(x, body.sort_by), reverse=reverse)

    return {"files": files, "total": len(files)}


# ---------------------------------------------------------------------------
# Routes — Drive folders
# ---------------------------------------------------------------------------


@app.get("/drive/folders")
async def drive_folders(parent_id: str = Query(default="root")):
    """List Google Drive folders inside *parent_id* (default: root)."""
    creds = auth.get_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        service = uploader.get_drive_service(creds)
        folders = uploader.list_drive_folders(service, parent_id=parent_id)
    except Exception as exc:
        logger.exception("Error listing Drive folders: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    return {"folders": folders}


# ---------------------------------------------------------------------------
# Routes — upload
# ---------------------------------------------------------------------------


@app.post("/upload/start")
async def upload_start(body: UploadStartRequest, background_tasks: BackgroundTasks):
    """
    Kick off an upload job in the background.
    Returns {job_id, total} immediately.
    """
    creds = auth.get_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not body.files:
        raise HTTPException(status_code=400, detail="No files specified")

    job = UploadJob.create(
        files=body.files,
        destination_folder_id=body.destination_folder_id,
        delay_ms=max(0, body.delay_ms),
    )
    _jobs[job.job_id] = job

    background_tasks.add_task(uploader.run_upload_job, job, creds)

    return {"job_id": job.job_id, "total": len(body.files)}


@app.get("/upload/progress/{job_id}")
async def upload_progress(job_id: str):
    """
    SSE endpoint that streams progress events for the given upload job.

    Events:
      connected  — emitted immediately on connection
      progress   — one per file processed
      done       — emitted when the job finishes
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        # Notify client that the stream is live
        yield f"event: connected\ndata: {json.dumps({'job_id': job_id})}\n\n"

        while True:
            try:
                event = await asyncio.wait_for(job.events.get(), timeout=30.0)
            except asyncio.TimeoutError:
                # Keep-alive comment to prevent proxy timeouts
                yield ": keepalive\n\n"
                continue

            if event.get("done"):
                yield f"event: done\ndata: {json.dumps({'status': job.status})}\n\n"
                break

            yield f"event: progress\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/upload/report/{job_id}")
async def upload_report(job_id: str):
    """Return the full upload report for *job_id* as JSON."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@app.get("/upload/report/{job_id}/csv")
async def upload_report_csv(job_id: str):
    """Return the upload report for *job_id* as a CSV file download."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["file", "size", "local_md5", "drive_md5", "status", "timestamp", "error"],
        extrasaction="ignore",
    )
    writer.writeheader()
    for row in job.results:
        writer.writerow(
            {
                "file": row.get("file", ""),
                "size": row.get("size", ""),
                "local_md5": row.get("local_md5", ""),
                "drive_md5": row.get("drive_md5", ""),
                "status": row.get("status", ""),
                "timestamp": row.get("timestamp", ""),
                "error": row.get("error", ""),
            }
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="report_{job_id[:8]}.csv"'
        },
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
