import base64
import logging
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.db import PipelineConfig

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
]


def get_oauth_flow() -> Flow:
    """Create Google OAuth2 flow."""
    client_config = {
        "web": {
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.gmail_redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.gmail_redirect_uri
    return flow


def get_auth_url() -> str:
    """Generate Google OAuth2 authorization URL."""
    flow = get_oauth_flow()
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url


async def exchange_code(code: str, db: AsyncSession) -> dict:
    """Exchange authorization code for tokens and store refresh token."""
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes or []),
    }

    # Store in pipeline_config
    existing = (await db.execute(
        select(PipelineConfig).where(PipelineConfig.key == "gmail_tokens")
    )).scalar_one_or_none()

    if existing:
        existing.value = token_data
    else:
        db.add(PipelineConfig(key="gmail_tokens", value=token_data))

    await db.commit()
    return {"status": "connected", "email": _get_email_address(credentials)}


async def get_gmail_credentials(db: AsyncSession) -> Credentials | None:
    """Load stored Gmail credentials."""
    config = (await db.execute(
        select(PipelineConfig).where(PipelineConfig.key == "gmail_tokens")
    )).scalar_one_or_none()

    if not config or not config.value:
        return None

    token_data = config.value
    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id", settings.gmail_client_id),
        client_secret=token_data.get("client_secret", settings.gmail_client_secret),
        scopes=token_data.get("scopes", SCOPES),
    )
    return creds


async def send_email(
    to: str,
    subject: str,
    body: str,
    db: AsyncSession,
    thread_id: str | None = None,
) -> dict:
    """Send an email via Gmail API."""
    creds = await get_gmail_credentials(db)
    if not creds:
        raise ValueError("Gmail not connected. Complete OAuth setup in Settings.")

    service = build("gmail", "v1", credentials=creds)

    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    body_payload = {"raw": raw}
    if thread_id:
        body_payload["threadId"] = thread_id

    result = service.users().messages().send(userId="me", body=body_payload).execute()

    return {
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
    }


async def check_replies(thread_ids: list[str], db: AsyncSession) -> list[dict]:
    """Check for new replies in email threads."""
    creds = await get_gmail_credentials(db)
    if not creds:
        return []

    service = build("gmail", "v1", credentials=creds)
    replies = []

    for thread_id in thread_ids:
        try:
            thread = service.users().threads().get(userId="me", id=thread_id).execute()
            messages = thread.get("messages", [])
            if len(messages) > 1:
                latest = messages[-1]
                headers = {h["name"]: h["value"] for h in latest.get("payload", {}).get("headers", [])}
                replies.append({
                    "thread_id": thread_id,
                    "from": headers.get("From", ""),
                    "date": headers.get("Date", ""),
                    "message_count": len(messages),
                })
        except Exception as e:
            logger.warning("Failed to check thread %s: %s", thread_id, e)

    return replies


async def get_connection_status(db: AsyncSession) -> dict:
    """Check if Gmail is connected."""
    creds = await get_gmail_credentials(db)
    if not creds:
        return {"connected": False}

    try:
        email = _get_email_address(creds)
        return {"connected": True, "email": email}
    except Exception:
        return {"connected": False, "error": "Token expired or invalid"}


def _get_email_address(creds: Credentials) -> str:
    """Get the authenticated user's email address."""
    try:
        service = build("gmail", "v1", credentials=creds)
        profile = service.users().getProfile(userId="me").execute()
        return profile.get("emailAddress", "")
    except Exception:
        return ""
