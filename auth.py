"""
auth.py - Google OAuth2 authentication helpers for GDrive AutoLoader.

Supports two credential sources:
  1. credentials.json  (standard Google Cloud Console download)
  2. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables

Token is persisted to token.json so the user only needs to authorise once.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional, Tuple

from dotenv import load_dotenv
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

load_dotenv()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
]

TOKEN_FILE = Path("token.json")
CREDENTIALS_FILE = Path("credentials.json")

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_client_config() -> dict:
    """
    Return a client-secrets dict suitable for google_auth_oauthlib.

    Prefers credentials.json; falls back to environment variables.
    Raises RuntimeError if neither source is available.
    """
    if CREDENTIALS_FILE.exists():
        with CREDENTIALS_FILE.open() as fh:
            data = json.load(fh)
        if "web" in data or "installed" in data:
            return data
        raise ValueError(
            "credentials.json does not contain a 'web' or 'installed' key."
        )

    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback").strip()

    if not client_id or not client_secret:
        raise RuntimeError(
            "No credentials found. Provide credentials.json or set "
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        )

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }


def _save_credentials(creds: Credentials) -> None:
    """Persist credentials to token.json."""
    TOKEN_FILE.write_text(creds.to_json())


# ---------------------------------------------------------------------------
# In-memory flow store (keyed by state) to survive the OAuth redirect round-trip
# ---------------------------------------------------------------------------

_pending_flows: dict[str, Flow] = {}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_credentials() -> Optional[Credentials]:
    """
    Load credentials from token.json and refresh if expired.

    Returns valid Credentials or None if the user has not authenticated.
    """
    if not TOKEN_FILE.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    except (ValueError, KeyError, json.JSONDecodeError):
        TOKEN_FILE.unlink(missing_ok=True)
        return None

    if creds.valid:
        return creds

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_credentials(creds)
            return creds
        except RefreshError:
            TOKEN_FILE.unlink(missing_ok=True)
            return None

    return None


def is_authenticated() -> bool:
    """Return True if valid credentials exist."""
    return get_credentials() is not None


def start_auth_flow(redirect_uri: str) -> Tuple[str, str]:
    """
    Initialise an OAuth2 flow and return (authorization_url, state).

    The flow object is stored in _pending_flows so that handle_callback
    can reuse it — this preserves any PKCE code verifier generated internally.
    """
    client_config = _build_client_config()

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    # Persist the flow so the callback can reuse it (same code verifier)
    _pending_flows[state] = flow

    return authorization_url, state


def handle_callback(code: str, redirect_uri: str, state: Optional[str] = None) -> Credentials:
    """
    Exchange an authorisation code for tokens and persist them.

    Reuses the original Flow (identified by state) to keep the PKCE verifier intact.
    Falls back to creating a new Flow if state is missing (e.g. during testing).
    """
    flow = _pending_flows.pop(state, None) if state else None

    if flow is None:
        # Fallback: create a plain flow without PKCE
        client_config = _build_client_config()
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )

    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_credentials(creds)
    return creds
