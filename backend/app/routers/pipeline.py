import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import parse_uuid
from app.models.db import Company, Job, Contact, Email, PipelineConfig
from app.models.schemas import (
    CompanyCreate, CompanyUpdate, CompanyOut,
    PipelineMetrics, PipelineConfigOut, PipelineConfigUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["pipeline"])


# ── Metrics ────────────────────────────────────────────────────

@router.get("/pipeline/metrics", response_model=PipelineMetrics)
async def get_metrics(db: AsyncSession = Depends(get_db)):
    companies = (await db.execute(select(func.count(Company.id)))).scalar() or 0
    jobs = (await db.execute(select(func.count(Job.id)))).scalar() or 0
    contacts = (await db.execute(select(func.count(Contact.id)))).scalar() or 0
    contacts_email = (await db.execute(
        select(func.count(Contact.id)).where(Contact.email.isnot(None))
    )).scalar() or 0
    emails = (await db.execute(select(func.count(Email.id)))).scalar() or 0

    # Jobs by status
    job_status_rows = (await db.execute(
        select(Job.status, func.count(Job.id)).group_by(Job.status)
    )).all()
    jobs_by_status = {row[0]: row[1] for row in job_status_rows}

    # Emails by status
    email_status_rows = (await db.execute(
        select(Email.status, func.count(Email.id)).group_by(Email.status)
    )).all()
    emails_by_status = {row[0]: row[1] for row in email_status_rows}

    reply_count = (await db.execute(
        select(func.count(Email.id)).where(Email.replied_at.isnot(None))
    )).scalar() or 0

    return PipelineMetrics(
        total_companies=companies,
        total_jobs=jobs,
        jobs_by_status=jobs_by_status,
        total_contacts=contacts,
        contacts_with_email=contacts_email,
        total_emails=emails,
        emails_by_status=emails_by_status,
        reply_count=reply_count,
    )


# ── Config ─────────────────────────────────────────────────────

@router.get("/pipeline/config", response_model=list[PipelineConfigOut])
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PipelineConfig))
    return result.scalars().all()


@router.put("/pipeline/config")
async def update_config(data: PipelineConfigUpdate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(PipelineConfig).where(PipelineConfig.key == data.key)
    )).scalar_one_or_none()

    if existing:
        existing.value = data.value
    else:
        db.add(PipelineConfig(key=data.key, value=data.value))

    await db.commit()
    return {"status": "ok"}


# ── Companies ──────────────────────────────────────────────────

SUGGESTED_COMPANIES = [
    {"name": "Anthropic", "greenhouse_slug": "anthropic", "domain": "anthropic.com", "careers_url": "https://job-boards.greenhouse.io/anthropic"},
    {"name": "OpenAI", "careers_url": "https://openai.com/careers", "domain": "openai.com"},
    {"name": "Vercel", "greenhouse_slug": "vercel", "domain": "vercel.com", "careers_url": "https://job-boards.greenhouse.io/vercel"},
    {"name": "Stripe", "greenhouse_slug": "stripe", "domain": "stripe.com"},
    {"name": "Figma", "greenhouse_slug": "figma", "domain": "figma.com"},
    {"name": "Retool", "careers_url": "https://retool.com/careers", "domain": "retool.com"},
    {"name": "ElevenLabs", "ashby_slug": "elevenlabs", "domain": "elevenlabs.io", "careers_url": "https://jobs.ashbyhq.com/elevenlabs"},
    {"name": "Deepgram", "ashby_slug": "deepgram", "domain": "deepgram.com", "careers_url": "https://jobs.ashbyhq.com/deepgram"},
    {"name": "Perplexity", "ashby_slug": "perplexity", "domain": "perplexity.ai", "careers_url": "https://jobs.ashbyhq.com/perplexity"},
    {"name": "Cohere", "ashby_slug": "cohere", "domain": "cohere.com", "careers_url": "https://jobs.ashbyhq.com/cohere"},
    {"name": "LangChain", "ashby_slug": "langchain", "domain": "langchain.com", "careers_url": "https://jobs.ashbyhq.com/langchain"},
    {"name": "Mistral AI", "lever_slug": "mistral", "domain": "mistral.ai", "careers_url": "https://jobs.lever.co/mistral"},
    {"name": "Spotify", "lever_slug": "spotify", "domain": "spotify.com", "careers_url": "https://jobs.lever.co/spotify"},
    {"name": "Weights & Biases", "lever_slug": "wandb", "domain": "wandb.com", "careers_url": "https://jobs.lever.co/wandb"},
    {"name": "Hugging Face", "workable_slug": "huggingface", "domain": "huggingface.co", "careers_url": "https://apply.workable.com/huggingface/"},
    {"name": "Airtable", "greenhouse_slug": "airtable", "domain": "airtable.com"},
    {"name": "Temporal", "greenhouse_slug": "temporal", "domain": "temporal.io"},
    {"name": "RunPod", "greenhouse_slug": "runpod", "domain": "runpod.io"},
    {"name": "Glean", "greenhouse_slug": "gleanwork", "domain": "glean.com"},
    {"name": "Runway", "greenhouse_slug": "runwayml", "domain": "runwayml.com"},
    {"name": "Pinecone", "ashby_slug": "pinecone", "domain": "pinecone.io", "careers_url": "https://jobs.ashbyhq.com/pinecone"},
    {"name": "Zapier", "ashby_slug": "zapier", "domain": "zapier.com", "careers_url": "https://jobs.ashbyhq.com/zapier"},
    {"name": "n8n", "ashby_slug": "n8n", "domain": "n8n.io", "careers_url": "https://jobs.ashbyhq.com/n8n"},
    {"name": "Celonis", "greenhouse_slug": "celonis", "domain": "celonis.com"},
    {"name": "N26", "greenhouse_slug": "n26", "domain": "n26.com"},
]


@router.get("/companies/suggestions")
async def company_suggestions():
    """Return a curated list of popular tech companies with pre-filled ATS slugs."""
    return SUGGESTED_COMPANIES


class BulkCompanyImport(BaseModel):
    companies: list[dict]


@router.post("/companies/import")
async def import_companies(data: BulkCompanyImport, db: AsyncSession = Depends(get_db)):
    """Bulk import companies. Skips duplicates (by name). Each item can have:
    name, domain, greenhouse_slug, lever_slug, ashby_slug, workable_slug, careers_url, ats_type, notes
    """
    added = 0
    skipped = 0
    for item in data.companies:
        name = item.get("name", "").strip()
        if not name:
            continue
        existing = (await db.execute(
            select(Company).where(func.lower(Company.name) == name.lower())
        )).scalar_one_or_none()
        if existing:
            skipped += 1
            continue
        company = Company(
            id=uuid.uuid4(),
            name=name,
            domain=item.get("domain"),
            greenhouse_slug=item.get("greenhouse_slug"),
            lever_slug=item.get("lever_slug"),
            ashby_slug=item.get("ashby_slug"),
            workable_slug=item.get("workable_slug"),
            careers_url=item.get("careers_url"),
            ats_type=item.get("ats_type"),
            notes=item.get("notes"),
            is_active=True,
        )
        db.add(company)
        added += 1
    await db.commit()
    return {"added": added, "skipped": skipped}


@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).order_by(Company.name))
    return result.scalars().all()


@router.post("/companies", response_model=CompanyOut)
async def create_company(data: CompanyCreate, db: AsyncSession = Depends(get_db)):
    company = Company(id=uuid.uuid4(), **data.model_dump())
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.put("/companies/{company_id}", response_model=CompanyOut)
async def update_company(company_id: str, data: CompanyUpdate, db: AsyncSession = Depends(get_db)):
    company = (await db.execute(
        select(Company).where(Company.id == parse_uuid(company_id))
    )).scalar_one()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return company


@router.get("/pipeline/export")
async def export_pipeline(db: AsyncSession = Depends(get_db)):
    """Export all pipeline data as JSON for backup/portability."""
    from app.models.db import Job, Contact, Email, Resume, ApplicationDraft, UserProfile

    companies = (await db.execute(select(Company).order_by(Company.name))).scalars().all()
    jobs = (await db.execute(select(Job).order_by(Job.scraped_at.desc()))).scalars().all()
    contacts = (await db.execute(select(Contact))).scalars().all()
    resumes = (await db.execute(select(Resume))).scalars().all()
    apps = (await db.execute(select(ApplicationDraft))).scalars().all()
    profile = (await db.execute(select(UserProfile).limit(1))).scalar_one_or_none()

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "companies": [CompanyOut.model_validate(c).model_dump(mode="json") for c in companies],
        "jobs_count": len(jobs),
        "contacts_count": len(contacts),
        "resumes_count": len(resumes),
        "applications_count": len(apps),
        "has_profile": profile is not None,
    }


@router.delete("/companies/{company_id}")
async def delete_company(company_id: str, db: AsyncSession = Depends(get_db)):
    company = (await db.execute(
        select(Company).where(Company.id == parse_uuid(company_id))
    )).scalar_one()
    await db.delete(company)
    await db.commit()
    return {"status": "deleted"}
