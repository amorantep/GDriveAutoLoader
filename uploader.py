import asyncio
import hashlib
import io
import mimetypes
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

CHUNK_SIZE = 8 * 1024 * 1024  # 8MB chunks
SMALL_FILE_THRESHOLD = 5 * 1024 * 1024  # 5MB


def calculate_md5(filepath: str) -> str:
    md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            md5.update(chunk)
    return md5.hexdigest()


def get_drive_service(credentials):
    return build("drive", "v3", credentials=credentials)


def list_drive_folders(service, parent_id: str = "root") -> List[Dict]:
    results = []
    page_token = None
    query = f"'{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    while True:
        params = {
            "q": query,
            "fields": "nextPageToken, files(id, name, parents)",
            "pageSize": 100,
            "orderBy": "name",
        }
        if page_token:
            params["pageToken"] = page_token
        response = service.files().list(**params).execute()
        results.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    return results


def check_file_exists_in_drive(service, filename: str, folder_id: str):
    safe_name = filename.replace("'", "\\'")
    query = f"name = '{safe_name}' and '{folder_id}' in parents and trashed = false"
    response = service.files().list(
        q=query, fields="files(id, name, md5Checksum)", pageSize=10
    ).execute()
    files = response.get("files", [])
    if not files:
        return False, None
    md5 = files[0].get("md5Checksum")
    return True, md5


def _get_mime_type(filepath: str) -> str:
    mime, _ = mimetypes.guess_type(filepath)
    return mime or "application/octet-stream"


def upload_file_simple(service, filepath: str, folder_id: str, mime_type: str) -> Dict:
    file_metadata = {"name": Path(filepath).name, "parents": [folder_id]}
    media = MediaFileUpload(filepath, mimetype=mime_type, resumable=False)
    uploaded = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, name, md5Checksum, size",
    ).execute()
    return uploaded


def upload_file_resumable(service, filepath: str, folder_id: str, mime_type: str) -> Dict:
    file_metadata = {"name": Path(filepath).name, "parents": [folder_id]}
    media = MediaFileUpload(filepath, mimetype=mime_type, resumable=True, chunksize=CHUNK_SIZE)
    request = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, name, md5Checksum, size",
    )
    response = None
    while response is None:
        _, response = request.next_chunk()
    return response


def upload_file(service, filepath: str, folder_id: str, delay_ms: int = 500) -> Dict:
    size = os.path.getsize(filepath)
    mime_type = _get_mime_type(filepath)
    max_retries = 7
    base_delay = 1.0
    for attempt in range(max_retries):
        try:
            if size <= SMALL_FILE_THRESHOLD:
                result = upload_file_simple(service, filepath, folder_id, mime_type)
            else:
                result = upload_file_resumable(service, filepath, folder_id, mime_type)
            if delay_ms > 0:
                time.sleep(delay_ms / 1000.0)
            return result
        except HttpError as e:
            if e.resp.status == 429:
                wait = base_delay * (2 ** attempt)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Failed to upload {filepath} after {max_retries} attempts")


@dataclass
class UploadResult:
    filename: str
    size: int
    local_md5: str
    drive_md5: Optional[str]
    status: str  # "ok", "failed", "skipped"
    timestamp: str
    error: Optional[str] = None


@dataclass
class UploadJob:
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    files: List[Dict] = field(default_factory=list)
    destination_folder_id: str = ""
    delay_ms: int = 500
    results: List[UploadResult] = field(default_factory=list)
    current_index: int = 0
    status: str = "pending"  # pending, running, completed, failed
    events: asyncio.Queue = field(default_factory=asyncio.Queue)

    def to_dict(self):
        return {
            "job_id": self.job_id,
            "status": self.status,
            "total": len(self.files),
            "current_index": self.current_index,
            "results": [
                {
                    "filename": r.filename,
                    "size": r.size,
                    "local_md5": r.local_md5,
                    "drive_md5": r.drive_md5,
                    "status": r.status,
                    "timestamp": r.timestamp,
                    "error": r.error,
                }
                for r in self.results
            ],
        }


async def run_upload_job(job: UploadJob, credentials) -> None:
    import datetime

    loop = asyncio.get_event_loop()
    job.status = "running"
    service = await loop.run_in_executor(None, lambda: get_drive_service(credentials))

    for i, file_info in enumerate(job.files):
        job.current_index = i
        filepath = file_info["path"]
        filename = file_info["name"]
        size = file_info["size"]
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"

        try:
            local_md5 = await loop.run_in_executor(None, lambda fp=filepath: calculate_md5(fp))
            exists, drive_md5 = await loop.run_in_executor(
                None,
                lambda fn=filename: check_file_exists_in_drive(service, fn, job.destination_folder_id),
            )

            if exists and drive_md5 and drive_md5 == local_md5:
                result = UploadResult(
                    filename=filename,
                    size=size,
                    local_md5=local_md5,
                    drive_md5=drive_md5,
                    status="skipped",
                    timestamp=timestamp,
                )
                job.results.append(result)
                await job.events.put({
                    "file": filename,
                    "index": i,
                    "total": len(job.files),
                    "status": "skipped",
                    "local_md5": local_md5,
                    "drive_md5": drive_md5,
                    "size": size,
                    "timestamp": timestamp,
                })
                continue

            uploaded = await loop.run_in_executor(
                None,
                lambda fp=filepath: upload_file(service, fp, job.destination_folder_id, job.delay_ms),
            )
            drive_md5_result = uploaded.get("md5Checksum")
            ok = drive_md5_result == local_md5 if drive_md5_result else False
            status = "ok" if ok else "failed"

            result = UploadResult(
                filename=filename,
                size=size,
                local_md5=local_md5,
                drive_md5=drive_md5_result,
                status=status,
                timestamp=timestamp,
            )
            job.results.append(result)
            await job.events.put({
                "file": filename,
                "index": i,
                "total": len(job.files),
                "status": status,
                "local_md5": local_md5,
                "drive_md5": drive_md5_result,
                "size": size,
                "timestamp": timestamp,
            })

        except Exception as e:
            result = UploadResult(
                filename=filename,
                size=size,
                local_md5="",
                drive_md5=None,
                status="failed",
                timestamp=timestamp,
                error=str(e),
            )
            job.results.append(result)
            await job.events.put({
                "file": filename,
                "index": i,
                "total": len(job.files),
                "status": "failed",
                "local_md5": "",
                "drive_md5": None,
                "size": size,
                "timestamp": timestamp,
                "error": str(e),
            })

    job.status = "completed"
    await job.events.put({"done": True})
