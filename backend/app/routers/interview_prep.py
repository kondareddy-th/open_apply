import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import parse_uuid
from app.models.db import InterviewQuestion, Job, Company
from app.models.schemas import (
    InterviewQuestionCreate, InterviewQuestionUpdate, InterviewQuestionOut,
    InterviewPrepStats, GenerateQuestionsRequest,
)
from app.services.interview_prep import generate_interview_questions

router = APIRouter(prefix="/api", tags=["interview-prep"])


@router.get("/interview-prep/questions", response_model=list[InterviewQuestionOut])
async def list_questions(
    category: str | None = Query(None),
    job_id: str | None = Query(None),
    difficulty: str | None = Query(None),
    confidence_max: int | None = Query(None, description="Filter questions with confidence <= this value"),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(InterviewQuestion).order_by(InterviewQuestion.created_at.desc())

    if category:
        query = query.where(InterviewQuestion.category == category)
    if job_id:
        query = query.where(InterviewQuestion.job_id == parse_uuid(job_id))
    if difficulty:
        query = query.where(InterviewQuestion.difficulty == difficulty)
    if confidence_max is not None:
        query = query.where(InterviewQuestion.confidence <= confidence_max)

    query = query.limit(limit).offset(offset)
    questions = (await db.execute(query)).scalars().all()
    return [InterviewQuestionOut.model_validate(q) for q in questions]


@router.post("/interview-prep/questions", response_model=InterviewQuestionOut)
async def create_question(
    data: InterviewQuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    question = InterviewQuestion(
        id=uuid.uuid4(),
        job_id=parse_uuid(data.job_id) if data.job_id else None,
        category=data.category,
        question=data.question,
        suggested_answer=data.suggested_answer,
        user_notes=data.user_notes,
        difficulty=data.difficulty,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return InterviewQuestionOut.model_validate(question)


@router.post("/interview-prep/generate/{job_id}")
async def generate_questions(
    job_id: str,
    data: GenerateQuestionsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(job_id))
    )).scalar_one()

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one()

    api_key = request.headers.get("X-Anthropic-Key", "") or settings.anthropic_api_key

    questions_data = await generate_interview_questions(
        job_title=job.title,
        company_name=company.name,
        job_description=job.description,
        api_key=api_key,
        count=data.count,
    )

    created = []
    for q in questions_data:
        question = InterviewQuestion(
            id=uuid.uuid4(),
            job_id=job.id,
            category=q.get("category", "behavioral"),
            question=q.get("question", ""),
            suggested_answer=q.get("suggested_answer"),
            difficulty=q.get("difficulty", "medium"),
        )
        db.add(question)
        created.append(question)

    await db.commit()
    for q in created:
        await db.refresh(q)

    return {
        "job_title": job.title,
        "company": company.name,
        "questions_generated": len(created),
        "questions": [InterviewQuestionOut.model_validate(q) for q in created],
    }


@router.patch("/interview-prep/questions/{question_id}", response_model=InterviewQuestionOut)
async def update_question(
    question_id: str,
    data: InterviewQuestionUpdate,
    db: AsyncSession = Depends(get_db),
):
    question = (await db.execute(
        select(InterviewQuestion).where(InterviewQuestion.id == parse_uuid(question_id))
    )).scalar_one()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    # Auto-increment times_practiced if confidence is being updated
    if data.confidence is not None:
        question.times_practiced = (question.times_practiced or 0) + 1
        question.last_practiced_at = datetime.utcnow()

    await db.commit()
    await db.refresh(question)
    return InterviewQuestionOut.model_validate(question)


@router.delete("/interview-prep/questions/{question_id}")
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
):
    question = (await db.execute(
        select(InterviewQuestion).where(InterviewQuestion.id == parse_uuid(question_id))
    )).scalar_one()

    await db.delete(question)
    await db.commit()
    return {"deleted": True}


@router.get("/interview-prep/stats", response_model=InterviewPrepStats)
async def get_stats(
    job_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    base = select(InterviewQuestion)
    if job_id:
        base = base.where(InterviewQuestion.job_id == parse_uuid(job_id))

    questions = (await db.execute(base)).scalars().all()

    if not questions:
        return InterviewPrepStats()

    total = len(questions)
    practiced = sum(1 for q in questions if q.times_practiced > 0)
    avg_conf = sum(q.confidence for q in questions) / total

    by_category: dict[str, dict] = {}
    for q in questions:
        cat = q.category
        if cat not in by_category:
            by_category[cat] = {"count": 0, "practiced": 0, "avg_confidence": 0, "total_confidence": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["total_confidence"] += q.confidence
        if q.times_practiced > 0:
            by_category[cat]["practiced"] += 1

    for cat in by_category:
        count = by_category[cat]["count"]
        by_category[cat]["avg_confidence"] = round(by_category[cat]["total_confidence"] / count, 1) if count else 0
        del by_category[cat]["total_confidence"]

    return InterviewPrepStats(
        total_questions=total,
        total_practiced=practiced,
        avg_confidence=round(avg_conf, 1),
        by_category=by_category,
    )
