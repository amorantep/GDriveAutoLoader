"""
uploader.py - Google Drive upload logic for GDrive AutoLoader.

Key features
  - MD5 calculation by streaming chunks (memory-safe)
  - Simple upload  (<= 5 MB)
  - Resumable upload (> 5 MB)
  - Duplicate detection: skip if same name AND same MD5 already in Drive
  - Exponential back-off on HTTP 429 / 5xx
  - Configurable delay between successive uploads
  - UploadJob dataclass + run_upload_job async generator
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import mimetypes
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHUNK_SIZE = 256 * 1024              # 256 KB — must be a multiple of 256 KB for Drive
SIMPLE_UPLOAD_THRESHOLD = 5 * 1024 * 1024  # 5 MB
MD5_READ_CHUNK = 1024 * 1024         # 1 MB chunks for hashing


# ---------------------------------------------------------------------------
# MD5 helper
# ---------------------------------------------------------------------------

def calculate_md5(filepath) -> str:
    """Stream *filepath* in chunks and return its lowercase hex MD5 digest."""
    h = hashlib.md5()
    with open(filepath, "rb") as fh:
        while True:
            buf = fh.read(MD5_READ_CHUNK)
            if not buf:
                break
            h.update(buf)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Drive service
# ---------------------------------------------------------------------------

def get_drive_service(credentials: Credentials):
    """Return an authorised Google Drive v3 service object."""
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


# ---------------------------------------------------------------------------
# Drive queries
# ---------------------------------------------------------------------------

def list_drive_folders(service, parent_id: str = "root") -> List[Dict]:
    """
    Return a list of folder metadata dicts directly inside *parent_id*.
    Each dict contains: id, name, modifiedTime.
    """
    query = (
        f"'{parent_id}' in parents "
        "and mimeType = 'application/vnd.google-apps.folder' "
        "and trashed = false"
    )
    results = []
    page_token = None

    while True:
        kwargs: dict = {
            "q": query,
            "spaces": "drive",
            "fields": "nextPageToken, files(id, name, modifiedTime)",
            "pageSize": 200,
            "orderBy": "name",
        }
        if page_token:
            kwargs["pageToken"] = page_token

        response = service.files().list(**kwargs).execute()
        results.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return results


def check_file_exists_in_drive(
    service, filename: str, folder_id: str
):
    """
    Check whether *filename* already exists inside *folder_id* in Drive.
    Returns (exists: bool, md5: str | None).
    """
    safe_name = filename.replace("'", "\\'")
    query = (
        f"name = '{safe_name}' "
        f"and '{folder_id}' in parents "
        "and trashed = false"
    )
    response = (
        service.files()
        .list(
            q=query,
            spaces="drive",
            fields="files(id, name, md5Checksum)",
            pageSize=1,
        )
        .execute()
    )
    files = response.get("files", [])
    if not files:
        return False, None
    return True, files[0].get("md5Checksum")


# ---------------------------------------------------------------------------
# Upload helpers
# ---------------------------------------------------------------------------

def _guess_mime(filepath) -> str:
    mime, _ = mimetypes.guess_type(str(filepath))
    return mime or "application/octet-stream"


def upload_file_simple(service, filepath, folder_id: str, mime_type: Optional[str] = None) -> Dict:
    """Upload a small file using the simple (non-resumable) method."""
    filepath = Path(filepath)
    mime_type = mime_type or _guess_mime(filepath)
    file_metadata = {"name": filepath.name, "parents": [folder_id]}
    media = MediaFileUpload(str(filepath), mimetype=mime_type, resumable=False)
    return (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id, name, md5Checksum")
        .execute()
    )


def upload_file_resumable(service, filepath, folder_id: str, mime_type: Optional[str] = None) -> Dict:
    """Upload a large file using Drive's resumable upload protocol."""
    filepath = Path(filepath)
    mime_type = mime_type or _guess_mime(filepath)
    file_metadata = {"name": filepath.name, "parents": [folder_id]}

    with open(filepath, "rb") as fh:
        media = MediaIoBaseUpload(fh, mimetype=mime_type, chunksize=CHUNK_SIZE, resumable=True)
        request = service.files().create(
            body=file_metadata, media_body=media, fields="id, name, md5Checksum"
        )
        uploaded = None
        while uploaded is None:
            _, uploaded = request.next_chunk()

    return uploaded


def upload_file(service, filepath, folder_id: str, delay_ms: int = 500) -> Dict:
    """
    Upload *filepath* to *folder_id*, choosing simple vs resumable by size.
    Handles HTTP 429 / 5xx with exponential back-off (up to 5 retries).
    """
    filepath = Path(filepath)
    file_size = filepath.stat().st_size
    mime_type = _guess_mime(filepath)
    max_retries = 5
    backoff = 2.0

    for attempt in range(max_retries + 1):
        try:
            if file_size <= SIMPLE_UPLOAD_THRESHOLD:
                result = upload_file_simple(service, filepath, folder_id, mime_type)
            else:
                result = upload_file_resumable(service, filepath, folder_id, mime_type)

            if delay_ms > 0:
                time.sleep(delay_ms / 1000.0)
            return result

        except HttpError as exc:
            status = exc.resp.status if exc.resp else 0
            if status in (429, 500, 502, 503, 504) and attempt < max_retries:
                wait = backoff * (2 ** attempt)
                logger.warning(
                    "Drive API %s for %s — retrying in %.1fs (attempt %d/%d)",
                    status, filepath.name, wait, attempt + 1, max_retries,
                )
                time.sleep(wait)
                continue
            raise


# ---------------------------------------------------------------------------
# UploadJob
# ---------------------------------------------------------------------------

@dataclass
class UploadJob:
    """Tracks the state of a batch upload operation."""

    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    files: List[Dict] = field(default_factory=list)
    destination_folder_id: str = ""
    delay_ms: int = 500
    results: List[Dict] = field(default_factory=list)
    current_index: int = 0
    status: str = "pending"  # pending | running | done | error
    # asyncio.Queue used to fan-out SSE events to the progress endpoint
    events: asyncio.Queue = field(default_factory=asyncio.Queue)

    @classmethod
    def create(cls, files: List[Dict], destination_folder_id: str, delay_ms: int = 500) -> "UploadJob":
        return cls(files=files, destination_folder_id=destination_folder_id, delay_ms=delay_ms)

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "total": len(self.files),
            "completed": len(self.results),
            "results": self.results,
        }


async def run_upload_job(job: UploadJob, credentials) -> None:
    """
    Process all files in *job* serially.

    Progress events are pushed into job.events (an asyncio.Queue).
    Each event dict has schema:
        {
            "file":       str,
            "index":      int,   # 1-based
            "total":      int,
            "status":     "skipped" | "uploaded" | "error",
            "local_md5":  str | None,
            "drive_md5":  str | None,
            "size":       int,
            "timestamp":  str,   # ISO-8601 UTC
        }
    A sentinel {"done": True} is pushed when the job finishes.
    """
    loop = asyncio.get_event_loop()
    job.status = "running"
    service = await loop.run_in_executor(None, lambda: get_drive_service(credentials))
    total = len(job.files)

    for i, file_info in enumerate(job.files):
        job.current_index = i
        filepath = file_info["path"]
        filename = file_info.get("name") or Path(filepath).name
        size = file_info.get("size", 0)
        timestamp = datetime.now(timezone.utc).isoformat()

        event: Dict = {
            "file": filename,
            "index": i + 1,
            "total": total,
            "status": "error",
            "local_md5": None,
            "drive_md5": None,
            "size": size,
            "timestamp": timestamp,
        }

        try:
            local_md5 = await loop.run_in_executor(
                None, lambda fp=filepath: calculate_md5(fp)
            )
            event["local_md5"] = local_md5

            exists, drive_md5 = await loop.run_in_executor(
                None,
                lambda fn=filename: check_file_exists_in_drive(service, fn, job.destination_folder_id),
            )

            if exists and drive_md5 and drive_md5.lower() == local_md5.lower():
                event["status"] = "skipped"
                event["drive_md5"] = drive_md5
            else:
                uploaded = await loop.run_in_executor(
                    None,
                    lambda fp=filepath: upload_file(service, fp, job.destination_folder_id, job.delay_ms),
                )
                event["status"] = "uploaded"
                event["drive_md5"] = uploaded.get("md5Checksum")

        except Exception as exc:
            logger.exception("Failed to upload %s: %s", filename, exc)
            event["status"] = "error"
            event["error"] = str(exc)

        job.results.append(event)
        await job.events.put(event)
        await asyncio.sleep(0)

    job.status = "done"
    await job.events.put({"done": True})
