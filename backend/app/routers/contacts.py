import logging
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.db import Contact, Job, Company
from app.models.schemas import ContactOut, ContactUpdate, DiscoverResult
from app.services.contact_finder import search_contacts, infer_emails, verify_mx, ALL_CONTACT_SOURCES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["contacts"])


class BulkDiscoverRequest(BaseModel):
    job_ids: list[str]


def _infer_domain_from_company(company_name: str) -> str | None:
    """Guess a company's email domain from its name (e.g., 'Anthropic' -> 'anthropic.com')."""
    name = company_name.strip().lower()
    for suffix in [" inc", " inc.", " llc", " ltd", " corp", " co", " ai"]:
        if name.endswith(suffix):
            name = name[: -len(suffix)].strip()
    name = name.replace(" ", "")
    if name:
        return f"{name}.com"
    return None


async def _add_contacts_from_results(
    db: AsyncSession, found: list[dict], job: Job, company: Company,
) -> int:
    """Add discovered contacts to DB, deduplicating and inferring emails."""
    contacts_added = 0
    email_domain = company.domain or _infer_domain_from_company(company.name)

    for item in found:
        linkedin_url = item.get("linkedin_url")
        name = item.get("name", "")

        # Dedup: check by linkedin_url if available, else by name
        if linkedin_url:
            existing = (await db.execute(
                select(Contact).where(
                    Contact.job_id == job.id,
                    Contact.linkedin_url == linkedin_url,
                )
            )).scalar_one_or_none()
        else:
            existing = (await db.execute(
                select(Contact).where(
                    Contact.job_id == job.id,
                    Contact.name == name,
                )
            )).scalar_one_or_none()

        if existing:
            continue

        contact = Contact(
            id=uuid.uuid4(),
            job_id=job.id,
            company_id=company.id,
            name=name,
            title=item.get("title"),
            linkedin_url=linkedin_url,
            source=item.get("source", "web_search"),
        )

        # Use email from AI if provided, otherwise infer from name + domain
        ai_email = item.get("email")
        if ai_email and "@" in ai_email:
            contact.email = ai_email
        elif email_domain:
            name_parts = name.split()
            if len(name_parts) >= 2:
                emails = infer_emails(name_parts[0], name_parts[-1], email_domain)
                if emails:
                    contact.email = emails[0]

        db.add(contact)
        contacts_added += 1

    return contacts_added


@router.post("/contacts/discover/{job_id}", response_model=DiscoverResult)
async def discover_contacts(
    job_id: str,
    request: Request,
    sources: str | None = Query(None, description="Comma-separated: web_search,ai_analysis"),
    db: AsyncSession = Depends(get_db),
):
    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(job_id))
    )).scalar_one()

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one()

    source_set = None
    if sources:
        source_set = {s.strip() for s in sources.split(",") if s.strip() in ALL_CONTACT_SOURCES}

    api_key = request.headers.get("X-Anthropic-Key", "") or settings.anthropic_api_key

    found = await search_contacts(
        company.name, company.domain,
        sources=source_set or None,
        job_title=job.title,
        job_url=job.url,
        job_description=job.description,
        api_key=api_key,
        db=db,
    )

    contacts_added = await _add_contacts_from_results(db, found, job, company)
    await db.commit()

    return DiscoverResult(
        job_title=job.title,
        company=company.name,
        contacts_found=contacts_added,
    )


@router.post("/contacts/discover-bulk")
async def discover_contacts_bulk(
    data: BulkDiscoverRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Discover contacts for multiple jobs at once."""
    api_key = request.headers.get("X-Anthropic-Key", "") or settings.anthropic_api_key
    results = []
    for job_id in data.job_ids:
        try:
            job = (await db.execute(
                select(Job).where(Job.id == parse_uuid(job_id))
            )).scalar_one_or_none()
            if not job:
                continue

            company = (await db.execute(
                select(Company).where(Company.id == job.company_id)
            )).scalar_one()

            found = await search_contacts(
                company.name, company.domain,
                job_title=job.title,
                job_url=job.url,
                job_description=job.description,
                api_key=api_key,
                db=db,
            )

            contacts_added = await _add_contacts_from_results(db, found, job, company)
            await db.commit()

            results.append({
                "job_id": job_id,
                "job_title": job.title,
                "company": company.name,
                "contacts_found": contacts_added,
            })
        except Exception:
            continue

    total = sum(r["contacts_found"] for r in results)
    return {"jobs_processed": len(results), "total_contacts_found": total, "results": results}


@router.get("/contacts", response_model=list[ContactOut])
async def list_contacts(
    company_id: str | None = Query(None),
    job_id: str | None = Query(None),
    has_email: bool | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Contact).order_by(Contact.created_at.desc())

    if company_id:
        query = query.where(Contact.company_id == parse_uuid(company_id))
    if job_id:
        query = query.where(Contact.job_id == parse_uuid(job_id))
    if has_email is True:
        query = query.where(Contact.email.isnot(None))
    elif has_email is False:
        query = query.where(Contact.email.is_(None))

    query = query.limit(limit).offset(offset)
    contacts = (await db.execute(query)).scalars().all()

    result = []
    for contact in contacts:
        out = ContactOut.model_validate(contact)
        if contact.company_id:
            company = (await db.execute(
                select(Company).where(Company.id == contact.company_id)
            )).scalar_one_or_none()
            out.company_name = company.name if company else None
        if contact.job_id:
            job = (await db.execute(
                select(Job).where(Job.id == contact.job_id)
            )).scalar_one_or_none()
            out.job_title = job.title if job else None
        result.append(out)

    return result


@router.post("/contacts/{contact_id}/verify-email")
async def verify_contact_email(contact_id: str, db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(
        select(Contact).where(Contact.id == parse_uuid(contact_id))
    )).scalar_one()

    if not contact.email:
        return {"verified": False, "reason": "No email address set"}

    domain = contact.email.split("@")[-1]
    has_mx = await verify_mx(domain)
    contact.email_verified = has_mx
    await db.commit()

    return {"verified": has_mx, "domain": domain}


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
async def update_contact(contact_id: str, data: ContactUpdate, db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(
        select(Contact).where(Contact.id == parse_uuid(contact_id))
    )).scalar_one()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)

    out = ContactOut.model_validate(contact)
    return out
