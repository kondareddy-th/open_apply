import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import parse_uuid, get_api_key, get_claude_model
from app.models.db import Email, Contact, Job, Company, EmailEvent
from app.models.schemas import EmailDraftRequest, EmailOut, EmailUpdate
from app.services.email_drafter import draft_email
from app.services.scraper import fetch_job_description

router = APIRouter(prefix="/api", tags=["emails"])


@router.post("/emails/draft", response_model=EmailOut)
async def create_draft(
    data: EmailDraftRequest,
    api_key: str = Depends(get_api_key),
    model: str = Depends(get_claude_model),
    db: AsyncSession = Depends(get_db),
):
    contact = (await db.execute(
        select(Contact).where(Contact.id == parse_uuid(data.contact_id))
    )).scalar_one()

    job = (await db.execute(
        select(Job).where(Job.id == parse_uuid(data.job_id))
    )).scalar_one()

    company = (await db.execute(
        select(Company).where(Company.id == job.company_id)
    )).scalar_one()

    # Get job description
    description = job.description
    if not description:
        description = await fetch_job_description(job.id, db)

    result = await draft_email(
        contact_name=contact.name,
        contact_title=contact.title or "",
        company_name=company.name,
        job_title=job.title,
        job_description=description,
        resume_context=data.resume_context,
        tone=data.tone,
        api_key=api_key,
        model=model,
    )

    email = Email(
        id=uuid.uuid4(),
        contact_id=contact.id,
        job_id=job.id,
        subject=result.get("subject", ""),
        body=result.get("body", ""),
        status="draft",
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)

    out = EmailOut.model_validate(email)
    out.contact_name = contact.name
    out.contact_email = contact.email
    out.job_title = job.title
    out.company_name = company.name
    return out


@router.get("/emails", response_model=list[EmailOut])
async def list_emails(
    status: str | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Email).order_by(Email.created_at.desc())

    if status:
        query = query.where(Email.status == status)

    query = query.limit(limit).offset(offset)
    emails = (await db.execute(query)).scalars().all()

    result = []
    for email in emails:
        out = EmailOut.model_validate(email)
        contact = (await db.execute(
            select(Contact).where(Contact.id == email.contact_id)
        )).scalar_one_or_none()
        job = (await db.execute(
            select(Job).where(Job.id == email.job_id)
        )).scalar_one_or_none()
        if contact:
            out.contact_name = contact.name
            out.contact_email = contact.email
        if job:
            out.job_title = job.title
            company = (await db.execute(
                select(Company).where(Company.id == job.company_id)
            )).scalar_one_or_none()
            out.company_name = company.name if company else None
        result.append(out)

    return result


@router.patch("/emails/{email_id}", response_model=EmailOut)
async def update_email(email_id: str, data: EmailUpdate, db: AsyncSession = Depends(get_db)):
    email = (await db.execute(
        select(Email).where(Email.id == parse_uuid(email_id))
    )).scalar_one()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(email, field, value)

    await db.commit()
    await db.refresh(email)
    return EmailOut.model_validate(email)


@router.post("/emails/{email_id}/approve")
async def approve_email(email_id: str, db: AsyncSession = Depends(get_db)):
    email = (await db.execute(
        select(Email).where(Email.id == parse_uuid(email_id))
    )).scalar_one()

    email.status = "approved"
    db.add(EmailEvent(
        id=uuid.uuid4(),
        email_id=email.id,
        event_type="approved",
    ))
    await db.commit()
    return {"status": "approved"}


@router.post("/emails/{email_id}/send")
async def send_email_now(email_id: str, db: AsyncSession = Depends(get_db)):
    from app.services.gmail import send_email

    email = (await db.execute(
        select(Email).where(Email.id == parse_uuid(email_id))
    )).scalar_one()

    contact = (await db.execute(
        select(Contact).where(Contact.id == email.contact_id)
    )).scalar_one()

    if not contact.email:
        return {"error": "Contact has no email address"}

    try:
        result = await send_email(
            to=contact.email,
            subject=email.subject,
            body=email.body,
            db=db,
            thread_id=email.gmail_thread_id,
        )

        email.status = "sent"
        email.sent_at = datetime.utcnow()
        email.gmail_message_id = result.get("message_id")
        email.gmail_thread_id = result.get("thread_id")

        db.add(EmailEvent(
            id=uuid.uuid4(),
            email_id=email.id,
            event_type="sent",
            event_metadata=result,
        ))
        await db.commit()
        return {"status": "sent", **result}

    except Exception as e:
        email.status = "failed"
        db.add(EmailEvent(
            id=uuid.uuid4(),
            email_id=email.id,
            event_type="failed",
            event_metadata={"error": str(e)},
        ))
        await db.commit()
        return {"error": str(e)}


@router.get("/emails/queue")
async def get_email_queue(db: AsyncSession = Depends(get_db)):
    approved = (await db.execute(
        select(Email).where(Email.status == "approved").order_by(Email.created_at)
    )).scalars().all()

    return [EmailOut.model_validate(e) for e in approved]
