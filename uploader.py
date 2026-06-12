"""
Upload logic for GDrive AutoLoader.
Handles MD5 calculation, deduplication, simple and resumable uploads,
and MD5 verification after upload.
"""

import asyncio
import hashlib
import io
import mimetypes
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import Resource
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

# Files larger than this threshold use resumable upload
RESUMABLE_THRESHOLD_BYTES = 5 * 1024 * 1024  # 5 MB
CHUNK_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB — for both MD5 streaming and resumable chunks

# In-memory job store: job_id -> job state dict
jobs: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# MD5 helpers
# ---------------------------------------------------------------------------

def calculate_md5(filepath: str) -> str:
    """
    Calculate the MD5 hash of a local file by streaming it in chunks.
    Never loads the entire file into memory.
    """
    md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE_BYTES)
            if not chunk:
                break
            md5.update(chunk)
    return md5.hexdigest()


# ---------------------------------------------------------------------------
# Drive helpers
# ---------------------------------------------------------------------------

def get_existing_drive_files(service: Resource, folder_id: str) -> Dict[str, str]:
    """
    List all non-trashed files in the given Drive folder.
    Returns a dict mapping filename -> md5Checksum (empty string if unavailable).
    Handles pagination automatically.
    """
    existing: Dict[str, str] = {}
    page_token: Optional[str] = None

    query = f"'{folder_id}' in parents and trashed = false"
    fields = "nextPageToken, files(name, md5Checksum)"

    while True:
        params: Dict[str, Any] = {
            "q": query,
            "fields": fields,
            "pageSize": 1000,
        }
        if page_token:
            params["pageToken"] = page_token

        try:
            response = service.files().list(**params).execute()
        except HttpError as e:
            raise RuntimeError(f"Failed to list Drive folder contents: {e}") from e

        for item in response.get("files", []):
            name = item.get("name", "")
            md5 = item.get("md5Checksum", "")
            existing[name] = md5

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return existing


def _get_mime_type(filepath: str) -> str:
    """Guess MIME type from file extension, defaulting to octet-stream."""
    mime, _ = mimetypes.guess_type(filepath)
    return mime or "application/octet-stream"


def _upload_simple(service: Resource, filepath: str, folder_id: str, mime_type: str) -> Dict[str, Any]:
    """Upload a small file using simple (non-resumable) upload."""
    file_metadata = {
        "name": Path(filepath).name,
        "parents": [folder_id],
    }
    media = MediaFileUpload(filepath, mimetype=mime_type, resumable=False)
    uploaded = (
        service.files()
        .create(
            body=file_metadata,
            media_body=media,
            fields="id, name, md5Checksum, size",
        )
        .execute()
    )
    return uploaded


def _upload_resumable(service: Resource, filepath: str, folder_id: str, mime_type: str) -> Dict[str, Any]:
    """Upload a large file using resumable upload with exponential backoff on 429."""
    file_metadata = {
        "name": Path(filepath).name,
        "parents": [folder_id],
    }
    media = MediaFileUpload(
        filepath,
        mimetype=mime_type,
        chunksize=CHUNK_SIZE_BYTES,
        resumable=True,
    )
    request = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, name, md5Checksum, size",
    )

    response = None
    backoff = 1  # seconds
    while response is None:
        try:
            _, response = request.next_chunk()
        except HttpError as e:
            if e.resp.status == 429:
                # Rate limited — exponential backoff
                time.sleep(backoff)
                backoff = min(backoff * 2, 64)
            else:
                raise

    return response


def upload_file(
    service: Resource,
    filepath: str,
    folder_id: str,
    existing_files: Dict[str, str],
    delay_ms: int,
) -> Dict[str, Any]:
    """
    Upload a single file to Drive with deduplication and MD5 verification.

    Returns a result dict with keys:
        filename, size, local_md5, drive_md5, status, timestamp
    Status values: "ok", "failed", "skipped"
    """
    path = Path(filepath)
    filename = path.name
    timestamp = datetime.now(timezone.utc).isoformat()

    file_size = path.stat().st_size

    # Calculate local MD5 before uploading
    try:
        local_md5 = calculate_md5(filepath)
    except OSError as e:
        return {
            "filename": filename,
            "size": 0,
            "local_md5": "",
            "drive_md5": "",
            "status": "failed",
            "error": f"Cannot read file: {e}",
            "timestamp": timestamp,
        }

    # Deduplication: same name AND same MD5 already in Drive → skip
    if filename in existing_files:
        drive_md5 = existing_files[filename]
        if drive_md5 and drive_md5.lower() == local_md5.lower():
            return {
                "filename": filename,
                "size": file_size,
                "local_md5": local_md5,
                "drive_md5": drive_md5,
                "status": "skipped",
                "timestamp": timestamp,
            }

    # Perform the upload
    mime_type = _get_mime_type(filepath)
    backoff = 1

    while True:
        try:
            if file_size > RESUMABLE_THRESHOLD_BYTES:
                uploaded = _upload_resumable(service, filepath, folder_id, mime_type)
            else:
                uploaded = _upload_simple(service, filepath, folder_id, mime_type)
            break
        except HttpError as e:
            if e.resp.status == 429:
                time.sleep(backoff)
                backoff = min(backoff * 2, 64)
            else:
                return {
                    "filename": filename,
                    "size": file_size,
                    "local_md5": local_md5,
                    "drive_md5": "",
                    "status": "failed",
                    "error": str(e),
                    "timestamp": timestamp,
                }
        except Exception as e:
            return {
                "filename": filename,
                "size": file_size,
                "local_md5": local_md5,
                "drive_md5": "",
                "status": "failed",
                "error": str(e),
                "timestamp": timestamp,
            }

    drive_md5 = (uploaded.get("md5Checksum") or "").lower()
    md5_match = drive_md5 and drive_md5 == local_md5.lower()

    # Honour configured inter-file delay
    if delay_ms > 0:
        time.sleep(delay_ms / 1000.0)

    return {
        "filename": filename,
        "size": file_size,
        "local_md5": local_md5,
        "drive_md5": drive_md5,
        "status": "ok" if md5_match else "failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Job runner
# ---------------------------------------------------------------------------

def run_upload_job(
    job_id: str,
    files: List[str],
    folder_id: str,
    delay_ms: int,
    service: Resource,
) -> None:
    """
    Run the upload job synchronously (called in a background thread).
    Updates the global `jobs` dict with progress events as each file completes.
    """
    job = jobs[job_id]
    job["status"] = "running"
    job["total"] = len(files)
    job["index"] = 0
    job["events"] = []
    job["report"] = []

    # Pre-fetch existing Drive files for deduplication
    try:
        existing_files = get_existing_drive_files(service, folder_id)
    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        return

    for index, filepath in enumerate(files):
        filename = Path(filepath).name
        job["current_file"] = filename
        job["index"] = index

        result = upload_file(service, filepath, folder_id, existing_files, delay_ms)

        # Append to report
        job["report"].append(result)

        # Build SSE event payload
        event = {
            "file": filename,
            "index": index + 1,
            "total": len(files),
            "status": result["status"],
            "local_md5": result.get("local_md5", ""),
            "drive_md5": result.get("drive_md5", ""),
            "size": result.get("size", 0),
            "timestamp": result.get("timestamp", ""),
            "error": result.get("error", ""),
        }
        job["events"].append(event)

        # Update dedup cache so subsequent files in the same run benefit
        if result["status"] in ("ok",):
            existing_files[filename] = result.get("local_md5", "")

    job["status"] = "done"
    job["index"] = len(files)
    job["current_file"] = ""
