from fastapi import APIRouter, Depends, Request
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.db import Company, Resume, UserProfile

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {"status": "ok", "db": db_status}


@router.get("/health/setup")
async def setup_check(request: Request, db: AsyncSession = Depends(get_db)):
    """Comprehensive setup check — validates all infra before first use.

    Returns a checklist of what's ready and what needs configuration.
    Used by the frontend onboarding flow.
    """
    checks = {}

    # 1. Database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {
            "status": "ok",
            "type": "sqlite" if settings.is_sqlite else "postgresql",
            "message": f"Connected ({('SQLite' if settings.is_sqlite else 'PostgreSQL')})",
        }
    except Exception as e:
        checks["database"] = {
            "status": "error",
            "type": "unknown",
            "message": f"Cannot connect: {e}",
        }

    # 2. LLM API Key
    anthropic_key = request.headers.get("X-Anthropic-Key", "") or settings.anthropic_api_key
    openai_key = request.headers.get("X-OpenAI-Key", "") or settings.openai_api_key

    if anthropic_key:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=anthropic_key)
            msg = await client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=10,
                messages=[{"role": "user", "content": "Say OK"}],
            )
            checks["llm"] = {
                "status": "ok",
                "provider": "anthropic",
                "message": "Anthropic API key is valid",
            }
        except Exception as e:
            checks["llm"] = {
                "status": "error",
                "provider": "anthropic",
                "message": f"Anthropic key invalid: {e}",
            }
    elif openai_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_key)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=10,
                messages=[{"role": "user", "content": "Say OK"}],
            )
            checks["llm"] = {
                "status": "ok",
                "provider": "openai",
                "message": "OpenAI API key is valid",
            }
        except Exception as e:
            checks["llm"] = {
                "status": "error",
                "provider": "openai",
                "message": f"OpenAI key invalid: {e}",
            }
    else:
        checks["llm"] = {
            "status": "missing",
            "provider": None,
            "message": "No API key configured. Add one in Settings.",
        }

    # 3. Companies configured
    try:
        company_count = (await db.execute(select(func.count(Company.id)))).scalar() or 0
        checks["companies"] = {
            "status": "ok" if company_count > 0 else "missing",
            "count": company_count,
            "message": f"{company_count} companies configured" if company_count else "No companies. Add target companies in Settings.",
        }
    except Exception:
        checks["companies"] = {"status": "error", "count": 0, "message": "Could not check companies"}

    # 4. Resume uploaded
    try:
        resume = (await db.execute(
            select(Resume).where(Resume.is_master == True)
        )).scalar_one_or_none()
        checks["resume"] = {
            "status": "ok" if resume else "missing",
            "message": "Master resume uploaded" if resume else "No resume. Upload one in the Resume page.",
        }
    except Exception:
        checks["resume"] = {"status": "missing", "message": "Resume table not ready (will auto-create on first use)"}

    # 5. User profile
    try:
        profile = (await db.execute(select(UserProfile).limit(1))).scalar_one_or_none()
        checks["profile"] = {
            "status": "ok" if profile else "missing",
            "message": "Profile configured" if profile else "No profile. Fill in your details in Settings for auto-apply.",
        }
    except Exception:
        checks["profile"] = {"status": "missing", "message": "Profile table not ready (will auto-create on first use)"}

    # 6. Gmail (optional)
    try:
        from app.services.gmail import get_connection_status
        gmail = await get_connection_status(db)
        checks["gmail"] = {
            "status": "ok" if gmail.get("connected") else "optional",
            "message": f"Connected as {gmail.get('email')}" if gmail.get("connected") else "Not connected (optional — for email outreach)",
        }
    except Exception:
        checks["gmail"] = {"status": "optional", "message": "Gmail not configured (optional)"}

    # Overall readiness
    required = ["database", "llm"]
    all_ok = all(checks.get(k, {}).get("status") == "ok" for k in required)

    return {
        "ready": all_ok,
        "checks": checks,
    }
