import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_api_key, get_claude_model, parse_uuid
from app.models.db import Job, Company, Contact, Email, EmailEvent
from app.models.schemas import JobOut, JobStatusUpdate, ScrapeResult
from app.services.scraper import scrape_all_companies, fetch_job_description, check_expired_jobs, ALL_SOURCES
from app.services.email_drafter import score_job_match

router = APIRouter(prefix="/api", tags=["jobs"])


class BulkDeleteRequest(BaseModel):
    job_ids: list[str]


@router.post("/jobs/search")
async def search_jobs_across_boards(
    request_body: dict = None,
    db: AsyncSession = Depends(get_db),
):
    """Search for jobs across all ATS boards by keyword.

    No pre-configured companies needed — uses web search to find matching postings.
    """
    from app.services.job_search import search_jobs_by_keyword
    from fastapi import Request

    body = request_body or {}
    keywords = body.get("keywords", "")
    boards = body.get("boards")  # optional: ["greenhouse", "lever", "ashby"]

    if not keywords:
        return {"error": "Keywords required", "results": []}

    results = await search_jobs_by_keyword(keywords, boards=boards)
    return {"keywords": keywords, "results": results, "count": len(results)}


@router.get("/jobs/board-status")
async def board_status(db: AsyncSession = Depends(get_db)):
    """Return which ATS boards are configured and ready to scrape."""
    from app.models.db import Company as CompanyModel
    companies = (await db.execute(
        select(CompanyModel).where(CompanyModel.is_active == True)
    )).scalars().all()

    boards = {}
    for c in companies:
        if c.greenhouse_slug:
            boards.setdefault("greenhouse", []).append(c.name)
        if c.lever_slug:
            boards.setdefault("lever", []).append(c.name)
        if c.ashby_slug:
            boards.setdefault("ashby", []).append(c.name)
        if c.workable_slug:
            boards.setdefault("workable", []).append(c.name)
        if c.careers_url and not (c.greenhouse_slug or c.lever_slug or c.ashby_slug or c.workable_slug):
            boards.setdefault("custom", []).append(c.name)

    return {
        "total_companies": len(companies),
        "boards": {k: {"count": len(v), "companies": v} for k, v in boards.items()},
    }


@router.post("/jobs/scrape", response_model=list[ScrapeResult])
async def scrape_jobs(
    sources: str | None = Query(None, description="Comma-separated: greenhouse,lever,ashby,workable,smartrecruiters,jobvite,custom"),
    db: AsyncSession = Depends(get_db),
):
    source_set = None
    if sources:
        source_set = {s.strip() for s in sources.split(",") if s.strip() in ALL_SOURCES}
    results = await scrape_all_companies(db, sources=source_set or None)
    return results


@router.get("/jobs/sources")
async def available_sources():
    """Return available scrape sources."""
    return {"sources": sorted(ALL_SOURCES)}


@router.get("/jobs", response_model=list[JobOut])
async def list_jobs(
    status: str | None = Query(None),
    source: str | None = Query(None),
    company_id: str | None = Query(None),
    min_score: float | None = Query(None),
    sort_by: str = Query("scraped_at", description="Sort field: scraped_at, posted_at"),
    sort_dir: str = Query("desc", description="Sort direction: asc, desc"),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    # Build sort clause
    sort_col = Job.posted_at if sort_by == "posted_at" else Job.scraped_at
    order = sort_col.asc().nullslast() if sort_dir == "asc" else sort_col.desc().nullslast()
    query = select(Job).order_by(order)

    if status:
        query = query.where(Job.status == status)
    if source:
        query = query.where(Job.source == source)
    if company_id:
        query = query.where(Job.company_id == parse_uuid(company_id))
    if min_score is not None:
        query = query.where(Job.match_score >= min_score)

    query = query.limit(limit).offset(offset)
    jobs = (await db.execute(query)).scalars().all()

    result = []
    for job in jobs:
        company = (await db.execute(
            select(Company).where(Company.id == job.company_id)
        )).scalar_one_or_none()

        contact_count = (await db.execute(
            select(func.count(Contact.id)).where(Contact.job_id == job.id)
        )).scalar() or 0

        out = JobOut.model_validate(job)
        out.company_name = company.name if company else None
        out.contact_count = contact_count
        result.append(out)

    return result


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(job_id))
    )).scalar_one()

    # Fetch description if missing
    if not job.description:
        await fetch_job_description(job.id, db)

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one_or_none()

    contact_count = (await db.execute(
        select(func.count(Contact.id)).where(Contact.job_id == job.id)
    )).scalar() or 0

    out = JobOut.model_validate(job)
    out.company_name = company.name if company else None
    out.contact_count = contact_count
    return out


@router.patch("/jobs/{job_id}", response_model=JobOut)
async def update_job_status(job_id: str, data: JobStatusUpdate, db: AsyncSession = Depends(get_db)):
    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(job_id))
    )).scalar_one()

    if data.status is not None:
        job.status = data.status
    if data.user_notes is not None:
        job.user_notes = data.user_notes
    if data.bookmarked is not None:
        job.bookmarked = data.bookmarked
    await db.commit()
    await db.refresh(job)

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one_or_none()

    out = JobOut.model_validate(job)
    out.company_name = company.name if company else None
    return out


@router.post("/jobs/match")
async def match_jobs(
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Score all unscored jobs using Claude + user's resume."""
    from app.models.db import PipelineConfig, Resume
    from app.services.resume import score_jobs_for_resume

    # Get resume content
    master = (await db.execute(
        select(Resume).where(Resume.is_master == True)
    )).scalar_one_or_none()
    resume_content = master.content if master else None

    # Get criteria as fallback
    config = (await db.execute(
        select(PipelineConfig).where(PipelineConfig.key == "role_criteria")
    )).scalar_one_or_none()
    criteria = config.value.get("criteria", "") if config else ""

    if not resume_content and not criteria:
        return {"error": "Upload a master resume or set role criteria in Settings first"}

    unscored = (await db.execute(
        select(Job).where(Job.match_score.is_(None), Job.status.in_(["new", "saved"])).limit(30)
    )).scalars().all()

    if not unscored:
        return {"scored": 0, "results": [], "message": "No unscored jobs"}

    # Build job dicts
    job_dicts = []
    for job in unscored:
        company = (await db.execute(
            select(Company).where(Company.id == job.company_id)
        )).scalar_one_or_none()
        job_dicts.append({
            "title": job.title,
            "company_name": company.name if company else "",
            "location": job.location,
            "description": job.description,
        })

    # Score via AI
    scores = await score_jobs_for_resume(
        resume_content=resume_content,
        sample_jd=criteria if not resume_content else None,
        jobs=job_dicts,
        api_key=api_key,
        model=model,
    )

    # Apply scores
    results = []
    for score_item in scores:
        idx = score_item.get("job_index", -1)
        if 0 <= idx < len(unscored):
            unscored[idx].match_score = score_item.get("score", 0)
            unscored[idx].match_reasoning = score_item.get("reasoning", "")
            results.append({"job": unscored[idx].title, "score": unscored[idx].match_score})

    await db.commit()
    return {"scored": len(results), "results": results}


@router.post("/jobs/check-expired")
async def check_expired(db: AsyncSession = Depends(get_db)):
    """Mark stale jobs (not seen in 7+ days) as expired."""
    result = await check_expired_jobs(db)
    return result


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a single job and its related contacts/emails."""
    jid = parse_uuid(job_id)

    # Delete related email events first (via emails)
    email_ids = (await db.execute(
        select(Email.id).where(Email.job_id == jid)
    )).scalars().all()
    if email_ids:
        await db.execute(delete(EmailEvent).where(EmailEvent.email_id.in_(email_ids)))

    # Delete emails and contacts
    await db.execute(delete(Email).where(Email.job_id == jid))
    await db.execute(delete(Contact).where(Contact.job_id == jid))
    await db.execute(delete(Job).where(Job.id == jid))
    await db.commit()
    return {"deleted": 1}


@router.post("/jobs/delete-bulk")
async def delete_jobs_bulk(data: BulkDeleteRequest, db: AsyncSession = Depends(get_db)):
    """Delete multiple jobs and their related contacts/emails."""
    job_uuids = [parse_uuid(jid) for jid in data.job_ids]

    # Delete related email events first (via emails)
    email_ids = (await db.execute(
        select(Email.id).where(Email.job_id.in_(job_uuids))
    )).scalars().all()
    if email_ids:
        await db.execute(delete(EmailEvent).where(EmailEvent.email_id.in_(email_ids)))

    # Delete emails, contacts, then jobs
    await db.execute(delete(Email).where(Email.job_id.in_(job_uuids)))
    await db.execute(delete(Contact).where(Contact.job_id.in_(job_uuids)))
    await db.execute(delete(Job).where(Job.id.in_(job_uuids)))
    await db.commit()
    return {"deleted": len(job_uuids)}
