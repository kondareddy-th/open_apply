import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import parse_uuid, get_api_key, get_claude_model
from app.models.db import Resume, Job, Company
from app.models.schemas import (
    ResumeCreate, ResumeEditRequest, ResumeTailorRequest,
    ResumeOut, RoleMatchRequest,
)
from app.services.resume import (
    edit_resume, tailor_resume, analyze_match,
    generate_cover_letter, parse_resume, score_jobs_for_resume,
)
from app.services.scraper import fetch_job_description

router = APIRouter(prefix="/api", tags=["resume"])


# ── CRUD ─────────────────────────────────────────────────────

@router.get("/resumes", response_model=list[ResumeOut])
async def list_resumes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Resume).order_by(Resume.is_master.desc(), Resume.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/resumes/master")
async def get_master_resume(db: AsyncSession = Depends(get_db)):
    """Get the master resume, or null if none exists."""
    result = await db.execute(
        select(Resume).where(Resume.is_master == True)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        return None
    return ResumeOut.model_validate(resume)


@router.post("/resumes", response_model=ResumeOut)
async def create_resume(data: ResumeCreate, db: AsyncSession = Depends(get_db)):
    """Create a new resume. If is_master=True, demote any existing master."""
    if data.is_master:
        existing_master = (await db.execute(
            select(Resume).where(Resume.is_master == True)
        )).scalar_one_or_none()
        if existing_master:
            existing_master.is_master = False

    resume = Resume(
        id=uuid.uuid4(),
        title=data.title,
        content=data.content,
        is_master=data.is_master,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


@router.put("/resumes/{resume_id}", response_model=ResumeOut)
async def update_resume(resume_id: str, data: ResumeCreate, db: AsyncSession = Depends(get_db)):
    resume = (await db.execute(
        select(Resume).where(Resume.id == parse_uuid(resume_id))
    )).scalar_one()

    resume.title = data.title
    resume.content = data.content
    if data.is_master and not resume.is_master:
        existing_master = (await db.execute(
            select(Resume).where(Resume.is_master == True, Resume.id != resume.id)
        )).scalar_one_or_none()
        if existing_master:
            existing_master.is_master = False
    resume.is_master = data.is_master
    resume.version += 1

    await db.commit()
    await db.refresh(resume)
    return resume


@router.delete("/resumes/{resume_id}")
async def delete_resume(resume_id: str, db: AsyncSession = Depends(get_db)):
    resume = (await db.execute(
        select(Resume).where(Resume.id == parse_uuid(resume_id))
    )).scalar_one()
    await db.delete(resume)
    await db.commit()
    return {"status": "deleted"}


# ── AI-Powered Editing ───────────────────────────────────────

@router.post("/resumes/{resume_id}/edit", response_model=ResumeOut)
async def edit_resume_nlp(
    resume_id: str,
    data: ResumeEditRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Edit a resume using natural language instructions."""
    resume = (await db.execute(
        select(Resume).where(Resume.id == parse_uuid(resume_id))
    )).scalar_one()

    result = await edit_resume(
        current_content=resume.content,
        instruction=data.instruction,
        api_key=api_key,
        model=model,
    )

    resume.content = result.get("resume", resume.content)
    resume.version += 1
    history = list(resume.edit_history or [])
    history.append({
        "prompt": data.instruction,
        "timestamp": datetime.utcnow().isoformat(),
        "changes_summary": result.get("changes_summary", ""),
    })
    resume.edit_history = history

    await db.commit()
    await db.refresh(resume)
    return resume


@router.post("/resumes/{resume_id}/suggestions")
async def get_resume_suggestions(
    resume_id: str,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Get AI-powered improvement suggestions for a resume."""
    resume = (await db.execute(
        select(Resume).where(Resume.id == parse_uuid(resume_id))
    )).scalar_one()

    from app.services.claude import _call_claude, parse_json_safe

    system = """You are a professional resume reviewer. Analyze this resume and provide 5 specific, actionable improvement suggestions.

Return JSON:
{
  "suggestions": [
    {"category": "content|format|keywords|impact|clarity", "title": "short title", "description": "specific actionable advice", "priority": "high|medium|low"}
  ],
  "overall_score": 75,
  "summary": "one sentence overall assessment"
}

Focus on:
- Missing quantifiable metrics
- Weak action verbs
- ATS optimization opportunities
- Structure/formatting issues
- Missing relevant keywords for the candidate's target roles

Return ONLY valid JSON."""

    prompt = f"Review this resume:\n\n{resume.content}"
    raw = await _call_claude(system, prompt, api_key, max_tokens=2048, model=model)
    result = parse_json_safe(raw, {"suggestions": [], "overall_score": 0, "summary": ""})
    return result


@router.post("/resumes/parse")
async def parse_resume_text(
    request: Request,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
):
    """Parse raw resume text into structured markdown."""
    body = await request.json()
    raw_text = body.get("text", "")
    if not raw_text:
        return {"error": "No text provided"}

    result = await parse_resume(raw_text, api_key, model)
    return result


# ── Tailoring & Matching ─────────────────────────────────────

@router.post("/resumes/{resume_id}/tailor", response_model=ResumeOut)
async def tailor_resume_for_job(
    resume_id: str,
    data: ResumeTailorRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Create a tailored copy of a resume for a specific job."""
    resume = (await db.execute(
        select(Resume).where(Resume.id == parse_uuid(resume_id))
    )).scalar_one()

    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(data.job_id))
    )).scalar_one()

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one()

    # Fetch JD if missing
    if not job.description:
        await fetch_job_description(job.id, db)

    result = await tailor_resume(
        master_content=resume.content,
        job_title=job.title,
        company_name=company.name,
        job_description=job.description,
        api_key=api_key,
        model=model,
    )

    # Create a new tailored resume
    tailored = Resume(
        id=uuid.uuid4(),
        title=f"{job.title} @ {company.name}",
        content=result.get("resume", resume.content),
        is_master=False,
        parent_id=resume.id,
        job_id=job.id,
        edit_history=[{
            "prompt": f"Tailored for {job.title} at {company.name}",
            "timestamp": datetime.utcnow().isoformat(),
            "changes_summary": result.get("changes_summary", ""),
            "keywords_matched": result.get("keywords_matched", []),
            "keywords_missing": result.get("keywords_missing", []),
        }],
    )
    db.add(tailored)
    await db.commit()
    await db.refresh(tailored)
    return tailored


@router.post("/resumes/{resume_id}/match/{job_id}")
async def match_resume_to_job(
    resume_id: str,
    job_id: str,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Analyze how well a resume matches a specific job."""
    resume = (await db.execute(
        select(Resume).where(Resume.id == parse_uuid(resume_id))
    )).scalar_one()

    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(job_id))
    )).scalar_one()

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one()

    if not job.description:
        await fetch_job_description(job.id, db)

    result = await analyze_match(
        resume_content=resume.content,
        job_title=job.title,
        company_name=company.name,
        job_description=job.description,
        api_key=api_key,
        model=model,
    )

    return {
        "job_id": job_id,
        "job_title": job.title,
        "company_name": company.name,
        **result,
    }


# ── Role Discovery ───────────────────────────────────────────

@router.post("/resumes/find-roles")
async def find_matching_roles(
    data: RoleMatchRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Find jobs that match the user's resume and/or a sample JD."""
    resume_content = None
    if data.use_resume:
        master = (await db.execute(
            select(Resume).where(Resume.is_master == True)
        )).scalar_one_or_none()
        if master:
            resume_content = master.content

    if not resume_content and not data.sample_jd:
        return {"error": "Provide a sample JD or create a master resume first"}

    # Get all unscored/new jobs
    jobs = (await db.execute(
        select(Job).where(Job.status.in_(["new", "saved"])).limit(30)
    )).scalars().all()

    if not jobs:
        return {"results": [], "message": "No new/saved jobs to match against"}

    # Build job dicts for scoring
    job_dicts = []
    for job in jobs:
        company = (await db.execute(
            select(Company).where(Company.id == job.company_id)
        )).scalar_one_or_none()
        job_dicts.append({
            "id": str(job.id),
            "title": job.title,
            "company_name": company.name if company else "",
            "location": job.location,
            "description": job.description,
        })

    scores = await score_jobs_for_resume(
        resume_content=resume_content,
        sample_jd=data.sample_jd,
        jobs=job_dicts,
        api_key=api_key,
        model=model,
    )

    # Map scores back to jobs
    results = []
    for score_item in scores:
        idx = score_item.get("job_index", -1)
        if 0 <= idx < len(job_dicts):
            results.append({
                **job_dicts[idx],
                "match_score": score_item.get("score", 0),
                "match_reasoning": score_item.get("reasoning", ""),
            })

    results.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    return {"results": results}
