import json
import os
from pathlib import Path
from typing import Optional, Tuple

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
TOKEN_FILE = Path("token.json")
CREDENTIALS_FILE = Path("credentials.json")

_pending_flow: Optional[Flow] = None


def _get_client_config() -> dict:
    if CREDENTIALS_FILE.exists():
        with open(CREDENTIALS_FILE) as f:
            return json.load(f)
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise ValueError(
            "No credentials.json found and GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars not set"
        )
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")],
        }
    }


def get_credentials() -> Optional[Credentials]:
    if not TOKEN_FILE.exists():
        return None
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_token(creds)
        except Exception:
            return None
    if creds and creds.valid:
        return creds
    return None


def is_authenticated() -> bool:
    creds = get_credentials()
    return creds is not None and creds.valid


def _save_token(creds: Credentials) -> None:
    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())


def start_auth_flow(redirect_uri: str) -> str:
    global _pending_flow
    client_config = _get_client_config()
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=redirect_uri)
    _pending_flow = flow
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url


def handle_callback(code: str, state: Optional[str] = None) -> Credentials:
    global _pending_flow
    if _pending_flow is None:
        redirect_uri = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
        client_config = _get_client_config()
        flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=redirect_uri)
    else:
        flow = _pending_flow
        _pending_flow = None
    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_token(creds)
    return creds
