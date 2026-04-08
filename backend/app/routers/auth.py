from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.gmail import get_auth_url, exchange_code, get_connection_status

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/gmail/url")
async def gmail_auth_url():
    if not settings.gmail_client_id:
        return {"error": "Gmail OAuth not configured. Set GMAIL_CLIENT_ID in environment."}
    url = get_auth_url()
    return {"url": url}


@router.get("/gmail/callback")
async def gmail_callback(code: str = Query(...), db: AsyncSession = Depends(get_db)):
    result = await exchange_code(code, db)
    # Redirect back to the app settings page
    base = settings.base_path or ""
    return RedirectResponse(url=f"{base}/settings?gmail=connected")


@router.get("/gmail/status")
async def gmail_status(db: AsyncSession = Depends(get_db)):
    return await get_connection_status(db)
