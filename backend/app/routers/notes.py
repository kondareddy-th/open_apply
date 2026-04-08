import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import parse_uuid
from app.models.db import Note
from app.models.schemas import NoteCreate, NoteUpdate, NoteOut

router = APIRouter(prefix="/api", tags=["notes"])


@router.get("/notes", response_model=list[NoteOut])
async def list_notes(
    search: str | None = Query(None),
    tag: str | None = Query(None),
    job_id: str | None = Query(None),
    pinned: bool | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Note).order_by(Note.pinned.desc(), Note.updated_at.desc())

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(Note.title.ilike(pattern), Note.content.ilike(pattern))
        )
    if tag:
        query = query.where(Note.tags.contains([tag]))
    if job_id:
        query = query.where(Note.job_id == parse_uuid(job_id))
    if pinned is not None:
        query = query.where(Note.pinned == pinned)

    query = query.limit(limit).offset(offset)
    notes = (await db.execute(query)).scalars().all()
    return [NoteOut.model_validate(n) for n in notes]


@router.post("/notes", response_model=NoteOut)
async def create_note(
    data: NoteCreate,
    db: AsyncSession = Depends(get_db),
):
    note = Note(
        id=uuid.uuid4(),
        job_id=parse_uuid(data.job_id) if data.job_id else None,
        title=data.title,
        content=data.content,
        tags=data.tags,
        pinned=data.pinned,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)


@router.get("/notes/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: str,
    db: AsyncSession = Depends(get_db),
):
    note = (await db.execute(
        select(Note).where(Note.id == parse_uuid(note_id))
    )).scalar_one()
    return NoteOut.model_validate(note)


@router.patch("/notes/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: str,
    data: NoteUpdate,
    db: AsyncSession = Depends(get_db),
):
    note = (await db.execute(
        select(Note).where(Note.id == parse_uuid(note_id))
    )).scalar_one()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(note, field, value)

    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    db: AsyncSession = Depends(get_db),
):
    note = (await db.execute(
        select(Note).where(Note.id == parse_uuid(note_id))
    )).scalar_one()
    await db.delete(note)
    await db.commit()
    return {"deleted": True}
