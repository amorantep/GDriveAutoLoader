"""
Google OAuth2 authentication module for GDrive AutoLoader.
Uses google-auth-oauthlib for the OAuth flow.
Credentials are stored in credentials.json (client secrets) and token.json (user token).
Falls back to GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars if credentials.json is absent.
"""

import json
import os
import secrets
from pathlib import Path
from typing import Optional, Tuple

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive.file"]

CREDENTIALS_FILE = Path("credentials.json")
TOKEN_FILE = Path("token.json")


def _credentials_file_exists() -> bool:
    return CREDENTIALS_FILE.exists() and CREDENTIALS_FILE.stat().st_size > 0


def _build_flow(redirect_uri: str) -> Flow:
    """
    Create a google_auth_oauthlib Flow.
    Prefers credentials.json; falls back to env vars GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
    """
    if _credentials_file_exists():
        return Flow.from_client_secrets_file(
            str(CREDENTIALS_FILE),
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )

    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise FileNotFoundError(
            "credentials.json not found and GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET "
            "env vars are not set. Download credentials.json from Google Cloud Console "
            "(APIs & Services > Credentials > OAuth 2.0 Client IDs > Download JSON) "
            "or set the env vars in your .env file."
        )
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }
    return Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=redirect_uri)


def get_credentials() -> Optional[Credentials]:
    """
    Load credentials from token.json if it exists and is valid.
    Refreshes the token automatically if expired.
    Returns None if no valid credentials are available.
    """
    if not TOKEN_FILE.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    except Exception:
        return None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_token(creds)
            return creds
        except Exception:
            TOKEN_FILE.unlink(missing_ok=True)
            return None

    return None


def is_authenticated() -> bool:
    """Return True if we have valid (or refreshable) credentials."""
    return get_credentials() is not None


def start_oauth_flow(redirect_uri: str) -> Tuple[str, str]:
    """
    Build the OAuth2 authorization URL and return (auth_url, state).
    The state value is stored server-side to verify the callback (CSRF protection).
    """
    state = secrets.token_urlsafe(32)
    flow = _build_flow(redirect_uri)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # Always request refresh_token
        state=state,
    )
    return auth_url, state


def exchange_code(code: str, redirect_uri: str, state: str = None) -> Credentials:
    """
    Exchange the authorization code for credentials and persist them to token.json.
    Returns the resulting Credentials object.
    """
    flow = _build_flow(redirect_uri)
    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_token(creds)
    return creds


def _save_token(creds: Credentials) -> None:
    """Persist credentials to token.json."""
    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
    }
    TOKEN_FILE.write_text(json.dumps(token_data, indent=2))


def get_drive_service():
    """Build and return a Drive v3 service using stored credentials."""
    creds = get_credentials()
    if not creds:
        raise RuntimeError("Not authenticated. Complete the OAuth flow first.")
    return build("drive", "v3", credentials=creds)


def revoke_credentials() -> None:
    """Delete the stored token, effectively logging the user out."""
    TOKEN_FILE.unlink(missing_ok=True)
