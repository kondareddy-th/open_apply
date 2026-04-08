import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import parse_uuid
from app.models.db import StudyConcept
from app.models.schemas import (
    StudyConceptCreate, StudyConceptUpdate, StudyConceptOut,
    TopicSummary, GenerateConceptsRequest,
)
from app.services.interview_prep import generate_study_concepts

router = APIRouter(prefix="/api", tags=["concepts"])


@router.get("/concepts", response_model=list[StudyConceptOut])
async def list_concepts(
    topic: str | None = Query(None),
    confidence_max: int | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(StudyConcept).order_by(StudyConcept.created_at.desc())

    if topic:
        query = query.where(StudyConcept.topic == topic)
    if confidence_max is not None:
        query = query.where(StudyConcept.confidence <= confidence_max)

    query = query.limit(limit).offset(offset)
    concepts = (await db.execute(query)).scalars().all()
    return [StudyConceptOut.model_validate(c) for c in concepts]


@router.post("/concepts", response_model=StudyConceptOut)
async def create_concept(
    data: StudyConceptCreate,
    db: AsyncSession = Depends(get_db),
):
    concept = StudyConcept(
        id=uuid.uuid4(),
        topic=data.topic,
        concept=data.concept,
        explanation=data.explanation,
        examples=data.examples,
    )
    db.add(concept)
    await db.commit()
    await db.refresh(concept)
    return StudyConceptOut.model_validate(concept)


@router.post("/concepts/generate")
async def generate_concepts(
    data: GenerateConceptsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    api_key = request.headers.get("X-Anthropic-Key", "") or settings.anthropic_api_key

    concepts_data = await generate_study_concepts(
        topic=data.topic,
        api_key=api_key,
        count=data.count,
    )

    created = []
    for c in concepts_data:
        concept = StudyConcept(
            id=uuid.uuid4(),
            topic=data.topic,
            concept=c.get("concept", ""),
            explanation=c.get("explanation"),
            examples=c.get("examples"),
        )
        db.add(concept)
        created.append(concept)

    await db.commit()
    for c in created:
        await db.refresh(c)

    return {
        "topic": data.topic,
        "concepts_generated": len(created),
        "concepts": [StudyConceptOut.model_validate(c) for c in created],
    }


@router.patch("/concepts/{concept_id}", response_model=StudyConceptOut)
async def update_concept(
    concept_id: str,
    data: StudyConceptUpdate,
    db: AsyncSession = Depends(get_db),
):
    concept = (await db.execute(
        select(StudyConcept).where(StudyConcept.id == parse_uuid(concept_id))
    )).scalar_one()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(concept, field, value)

    if data.confidence is not None:
        concept.review_count = (concept.review_count or 0) + 1
        concept.last_reviewed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(concept)
    return StudyConceptOut.model_validate(concept)


@router.delete("/concepts/{concept_id}")
async def delete_concept(
    concept_id: str,
    db: AsyncSession = Depends(get_db),
):
    concept = (await db.execute(
        select(StudyConcept).where(StudyConcept.id == parse_uuid(concept_id))
    )).scalar_one()
    await db.delete(concept)
    await db.commit()
    return {"deleted": True}


@router.get("/concepts/topics", response_model=list[TopicSummary])
async def list_topics(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            StudyConcept.topic,
            func.count(StudyConcept.id).label("count"),
            func.avg(StudyConcept.confidence).label("avg_confidence"),
        ).group_by(StudyConcept.topic).order_by(func.count(StudyConcept.id).desc())
    )

    topics = []
    for row in result.all():
        topics.append(TopicSummary(
            topic=row.topic,
            count=row.count,
            avg_confidence=round(float(row.avg_confidence or 0), 1),
        ))

    return topics
