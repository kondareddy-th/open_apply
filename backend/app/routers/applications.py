import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import parse_uuid, get_api_key, get_claude_model
from app.models.db import ApplicationDraft, Resume, Job, Company
from app.models.schemas import (
    ApplicationPrepRequest, ApplicationDraftOut,
    ApplicationStatusUpdate,
)
from app.services.resume import tailor_resume, analyze_match, generate_cover_letter
from app.services.scraper import fetch_job_description

router = APIRouter(prefix="/api", tags=["applications"])


@router.get("/applications/stats")
async def application_stats(db: AsyncSession = Depends(get_db)):
    """Dashboard stats for applications."""
    from sqlalchemy import func
    total = (await db.execute(select(func.count(ApplicationDraft.id)))).scalar() or 0
    by_status = dict((await db.execute(
        select(ApplicationDraft.status, func.count(ApplicationDraft.id)).group_by(ApplicationDraft.status)
    )).all())

    # Average match score
    avg_score = (await db.execute(
        select(func.avg(ApplicationDraft.match_score)).where(ApplicationDraft.match_score.isnot(None))
    )).scalar()

    # Applied this week
    from datetime import datetime, timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    applied_this_week = (await db.execute(
        select(func.count(ApplicationDraft.id)).where(
            ApplicationDraft.status == "applied",
            ApplicationDraft.applied_at >= week_ago,
        )
    )).scalar() or 0

    return {
        "total": total,
        "by_status": by_status,
        "avg_match_score": round(avg_score, 1) if avg_score else None,
        "applied_this_week": applied_this_week,
    }


@router.get("/applications", response_model=list[ApplicationDraftOut])
async def list_applications(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ApplicationDraft).order_by(ApplicationDraft.updated_at.desc())
    if status:
        query = query.where(ApplicationDraft.status == status)

    drafts = (await db.execute(query)).scalars().all()

    results = []
    for draft in drafts:
        out = ApplicationDraftOut.model_validate(draft)
        job = (await db.execute(select(Job).where(Job.id == draft.job_id))).scalar_one_or_none()
        if job:
            out.job_title = job.title
            out.job_url = job.url
            company = (await db.execute(select(Company).where(Company.id == job.company_id))).scalar_one_or_none()
            out.company_name = company.name if company else None
        results.append(out)

    return results


@router.get("/applications/{app_id}", response_model=ApplicationDraftOut)
async def get_application(app_id: str, db: AsyncSession = Depends(get_db)):
    draft = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.id == parse_uuid(app_id))
    )).scalar_one()

    out = ApplicationDraftOut.model_validate(draft)
    job = (await db.execute(select(Job).where(Job.id == draft.job_id))).scalar_one_or_none()
    if job:
        out.job_title = job.title
        out.job_url = job.url
        company = (await db.execute(select(Company).where(Company.id == job.company_id))).scalar_one_or_none()
        out.company_name = company.name if company else None
    return out


@router.post("/applications/prepare", response_model=ApplicationDraftOut)
async def prepare_application(
    data: ApplicationPrepRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Full application prep: tailor resume + generate cover letter + match analysis.

    This is the main endpoint that takes a job and produces everything needed
    for the user to review before applying.
    """
    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(data.job_id))
    )).scalar_one()

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one()

    # Fetch JD if missing
    if not job.description:
        await fetch_job_description(job.id, db)

    # Get master resume
    master = (await db.execute(
        select(Resume).where(Resume.is_master == True)
    )).scalar_one_or_none()

    if not master:
        return {"error": "Create a master resume first in the Resume page"}

    # Check if we already have an application draft for this job
    existing = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.job_id == job.id)
    )).scalar_one_or_none()

    # 1. Tailor resume
    tailor_result = await tailor_resume(
        master_content=master.content,
        job_title=job.title,
        company_name=company.name,
        job_description=job.description,
        api_key=api_key,
        model=model,
    )

    # Save tailored resume
    tailored_resume = Resume(
        id=uuid.uuid4(),
        title=f"{job.title} @ {company.name}",
        content=tailor_result.get("resume", master.content),
        is_master=False,
        parent_id=master.id,
        job_id=job.id,
        edit_history=[{
            "prompt": f"Auto-tailored for {job.title} at {company.name}",
            "timestamp": datetime.utcnow().isoformat(),
            "changes_summary": tailor_result.get("changes_summary", ""),
        }],
    )
    db.add(tailored_resume)
    await db.flush()

    # 2. Match analysis
    match_result = await analyze_match(
        resume_content=tailor_result.get("resume", master.content),
        job_title=job.title,
        company_name=company.name,
        job_description=job.description,
        api_key=api_key,
        model=model,
    )

    # 3. Cover letter
    cover_letter = await generate_cover_letter(
        resume_content=tailor_result.get("resume", master.content),
        job_title=job.title,
        company_name=company.name,
        job_description=job.description,
        api_key=api_key,
        model=model,
    )

    # Build talking points from match analysis
    talking_points = [{"text": tp} for tp in match_result.get("talking_points", [])]

    if existing:
        # Update existing draft
        existing.resume_id = tailored_resume.id
        existing.cover_letter = cover_letter
        existing.tailored_summary = match_result.get("summary", "")
        existing.match_score = match_result.get("score", 0)
        existing.match_analysis = match_result.get("summary", "")
        existing.key_talking_points = talking_points
        existing.status = "ready"
        await db.commit()
        await db.refresh(existing)
        draft = existing
    else:
        # Create new draft
        draft = ApplicationDraft(
            id=uuid.uuid4(),
            job_id=job.id,
            resume_id=tailored_resume.id,
            cover_letter=cover_letter,
            tailored_summary=match_result.get("summary", ""),
            match_score=match_result.get("score", 0),
            match_analysis=match_result.get("summary", ""),
            key_talking_points=talking_points,
            status="ready",
        )
        db.add(draft)
        await db.commit()
        await db.refresh(draft)

    # Update job status
    job.status = "saved"
    job.match_score = match_result.get("score", 0)
    job.match_reasoning = match_result.get("summary", "")
    await db.commit()

    out = ApplicationDraftOut.model_validate(draft)
    out.job_title = job.title
    out.job_url = job.url
    out.company_name = company.name
    return out


@router.patch("/applications/{app_id}", response_model=ApplicationDraftOut)
async def update_application_status(
    app_id: str,
    data: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    draft = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.id == parse_uuid(app_id))
    )).scalar_one()

    draft.status = data.status
    if data.notes:
        draft.notes = data.notes
    if data.status == "applied":
        draft.applied_at = datetime.utcnow()
        # Also update job status
        job = (await db.execute(select(Job).where(Job.id == draft.job_id))).scalar_one_or_none()
        if job:
            job.status = "emailed"

    await db.commit()
    await db.refresh(draft)

    out = ApplicationDraftOut.model_validate(draft)
    job = (await db.execute(select(Job).where(Job.id == draft.job_id))).scalar_one_or_none()
    if job:
        out.job_title = job.title
        out.job_url = job.url
        company = (await db.execute(select(Company).where(Company.id == job.company_id))).scalar_one_or_none()
        out.company_name = company.name if company else None
    return out


class GenerateInterviewPrepRequest(BaseModel):
    count: int = 10


@router.post("/applications/{app_id}/interview-prep")
async def generate_interview_prep_for_app(
    app_id: str,
    data: GenerateInterviewPrepRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Generate role-specific interview questions from application data."""
    draft = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.id == parse_uuid(app_id))
    )).scalar_one()

    job = (await db.execute(select(Job).where(Job.id == draft.job_id))).scalar_one()
    company = (await db.execute(select(Company).where(Company.id == job.company_id))).scalar_one()

    resume_content = ""
    if draft.resume_id:
        resume = (await db.execute(select(Resume).where(Resume.id == draft.resume_id))).scalar_one_or_none()
        if resume:
            resume_content = resume.content

    from app.services.claude import _call_claude, parse_json_safe

    system = """You are an expert interview coach. Generate likely interview questions for this specific role.

Return JSON:
{
  "questions": [
    {"category": "behavioral|technical|system_design|company_specific", "question": "...", "suggested_answer": "...", "difficulty": "easy|medium|hard"}
  ]
}

Include a mix of categories. For suggested_answer, use the candidate's actual experience from their resume.
Return ONLY valid JSON."""

    jd_section = f"\n\nJob Description:\n{job.description[:2000]}" if job.description else ""
    resume_section = f"\n\nCandidate Resume:\n{resume_content[:2000]}" if resume_content else ""

    prompt = f"Role: {job.title} at {company.name}{jd_section}{resume_section}\n\nGenerate {data.count} interview questions."

    raw = await _call_claude(system, prompt, api_key, max_tokens=4096, model=model)
    result = parse_json_safe(raw, {"questions": []})

    # Optionally save to interview_questions table
    from app.models.db import InterviewQuestion
    import uuid as _uuid
    saved = 0
    for q in result.get("questions", []):
        iq = InterviewQuestion(
            id=_uuid.uuid4(),
            job_id=job.id,
            category=q.get("category", "behavioral"),
            question=q.get("question", ""),
            suggested_answer=q.get("suggested_answer"),
            difficulty=q.get("difficulty", "medium"),
        )
        db.add(iq)
        saved += 1
    await db.commit()

    return {"generated": saved, "questions": result.get("questions", [])}


class GenerateFormAnswersRequest(BaseModel):
    questions: list[str]


@router.post("/applications/{app_id}/form-answers")
async def generate_form_answers(
    app_id: str,
    data: GenerateFormAnswersRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Generate answers for job application form questions using AI + resume + profile."""
    draft = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.id == parse_uuid(app_id))
    )).scalar_one()

    job = (await db.execute(select(Job).where(Job.id == draft.job_id))).scalar_one()
    company = (await db.execute(select(Company).where(Company.id == job.company_id))).scalar_one()

    resume_text = ""
    if draft.resume_id:
        r = (await db.execute(select(Resume).where(Resume.id == draft.resume_id))).scalar_one_or_none()
        if r:
            resume_text = r.content

    from app.models.db import UserProfile
    profile = (await db.execute(select(UserProfile).limit(1))).scalar_one_or_none()
    profile_info = ""
    if profile:
        parts = [f"Name: {profile.full_name}"]
        if profile.email:
            parts.append(f"Email: {profile.email}")
        if profile.location:
            parts.append(f"Location: {profile.location}")
        if profile.work_authorization:
            parts.append(f"Work Auth: {profile.work_authorization}")
        if profile.willing_to_relocate:
            parts.append("Willing to relocate: Yes")
        profile_info = "\n".join(parts)

    from app.services.claude import _call_claude, parse_json_safe

    system = """You are filling out a job application. Generate concise, honest answers.
- Be specific, never generic
- For "Why [Company]?" — reference specifics that align with the candidate
- Keep answers 1-3 sentences unless more is needed
- NEVER fabricate experience

Return JSON: {"answers": [{"question": "...", "answer": "..."}]}
Return ONLY valid JSON."""

    questions_text = "\n".join(f"Q{i+1}: {q}" for i, q in enumerate(data.questions))
    prompt = f"Job: {job.title} at {company.name}\n\nResume:\n{resume_text[:2000]}\n\nProfile:\n{profile_info}\n\nQuestions:\n{questions_text}"

    raw = await _call_claude(system, prompt, api_key, max_tokens=4096, model=model)
    result = parse_json_safe(raw, {"answers": []})
    return result


class EditCoverLetterRequest(BaseModel):
    instruction: str


@router.post("/applications/{app_id}/edit-cover-letter")
async def edit_cover_letter(
    app_id: str,
    data: EditCoverLetterRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    """Edit the cover letter using natural language instructions."""
    draft = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.id == parse_uuid(app_id))
    )).scalar_one()

    if not draft.cover_letter:
        return {"error": "No cover letter to edit"}

    from app.services.claude import _call_claude

    system = """You are editing a cover letter based on user instructions.
Apply the requested changes and return ONLY the updated cover letter text.
Keep it professional, under 300 words, and specific to the role."""

    prompt = f"""Current cover letter:

{draft.cover_letter}

User's instruction: {data.instruction}

Return the updated cover letter."""

    new_cl = await _call_claude(system, prompt, api_key, max_tokens=2048, model=model)
    draft.cover_letter = new_cl
    await db.commit()
    await db.refresh(draft)

    return {"cover_letter": new_cl}


@router.delete("/applications/{app_id}")
async def delete_application(app_id: str, db: AsyncSession = Depends(get_db)):
    draft = (await db.execute(
        select(ApplicationDraft).where(ApplicationDraft.id == parse_uuid(app_id))
    )).scalar_one()
    await db.delete(draft)
    await db.commit()
    return {"status": "deleted"}
