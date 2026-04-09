import json
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey,
    UniqueConstraint, Index, TypeDecorator,
)
from sqlalchemy.orm import DeclarativeBase, relationship

from app.config import settings


# ── Portable types (work on both SQLite and PostgreSQL) ──────

class GUID(TypeDecorator):
    """Platform-independent UUID type. Uses PostgreSQL UUID when available,
    stores as CHAR(36) on SQLite."""
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class JSONType(TypeDecorator):
    """Platform-independent JSON type. Uses PostgreSQL JSONB when available,
    stores as TEXT (JSON string) on SQLite."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB
            return dialect.type_descriptor(JSONB)
        return dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        if isinstance(value, str):
            return json.loads(value)
        return value


class Base(DeclarativeBase):
    pass


class Company(Base):
    __tablename__ = "companies"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    domain = Column(String(255))
    greenhouse_slug = Column(String(255))
    lever_slug = Column(String(255))
    ashby_slug = Column(String(255))
    workable_slug = Column(String(255))
    careers_url = Column(String(1000))  # Direct careers page URL
    ats_type = Column(String(50))  # greenhouse, lever, ashby, workable, smartrecruiters, jobvite, custom
    notes = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    jobs = relationship("Job", back_populates="company", lazy="noload")
    contacts = relationship("Contact", back_populates="company", lazy="noload")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_job_source_external"),
        Index("ix_jobs_status", "status"),
        Index("ix_jobs_company", "company_id"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID, ForeignKey("companies.id"), nullable=False)
    external_id = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False)  # "greenhouse" or "lever"
    title = Column(String(500), nullable=False)
    department = Column(String(255))
    location = Column(String(500))
    description = Column(Text)
    url = Column(String(1000))
    match_score = Column(Float)
    match_reasoning = Column(Text)
    status = Column(String(50), default="new", nullable=False)
    user_notes = Column(Text)  # User's "why this role" annotation
    bookmarked = Column(Boolean, default=False)
    posted_at = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    company = relationship("Company", back_populates="jobs")
    contacts = relationship("Contact", back_populates="job", lazy="noload")
    emails = relationship("Email", back_populates="job", lazy="noload")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID, ForeignKey("jobs.id"))
    company_id = Column(GUID, ForeignKey("companies.id"))
    name = Column(String(255), nullable=False)
    title = Column(String(255))
    linkedin_url = Column(String(1000))
    email = Column(String(255))
    email_verified = Column(Boolean, default=False)
    source = Column(String(100))  # "google_search", "manual"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    job = relationship("Job", back_populates="contacts")
    company = relationship("Company", back_populates="contacts")
    emails = relationship("Email", back_populates="contact", lazy="noload")


class Email(Base):
    __tablename__ = "emails"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    contact_id = Column(GUID, ForeignKey("contacts.id"), nullable=False)
    job_id = Column(GUID, ForeignKey("jobs.id"), nullable=False)
    sequence_num = Column(Integer, default=1, nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(50), default="draft", nullable=False)
    gmail_message_id = Column(String(255))
    gmail_thread_id = Column(String(255))
    scheduled_at = Column(DateTime)
    sent_at = Column(DateTime)
    opened_at = Column(DateTime)
    replied_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    contact = relationship("Contact", back_populates="emails")
    job = relationship("Job", back_populates="emails")
    events = relationship("EmailEvent", back_populates="email", lazy="noload")


class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    email_id = Column(GUID, ForeignKey("emails.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    event_metadata = Column("metadata", JSONType, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    email = relationship("Email", back_populates="events")


class PipelineConfig(Base):
    __tablename__ = "pipeline_config"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    key = Column(String(255), unique=True, nullable=False)
    value = Column(JSONType, default=dict)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ── Interview Prep ────────────────────────────────────────────

class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    __table_args__ = (
        Index("ix_iq_category", "category"),
        Index("ix_iq_job", "job_id"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID, ForeignKey("jobs.id"), nullable=True)
    category = Column(String(100), nullable=False)  # behavioral, technical, system_design, company_specific
    question = Column(Text, nullable=False)
    suggested_answer = Column(Text)
    user_notes = Column(Text)
    difficulty = Column(String(20), default="medium")  # easy, medium, hard
    confidence = Column(Integer, default=0)  # 0-5
    times_practiced = Column(Integer, default=0)
    last_practiced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    job = relationship("Job", foreign_keys=[job_id])


# ── Notes ─────────────────────────────────────────────────────

class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        Index("ix_notes_job", "job_id"),
        Index("ix_notes_pinned", "pinned"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID, ForeignKey("jobs.id"), nullable=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, default="")
    tags = Column(JSONType, default=list)
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    job = relationship("Job", foreign_keys=[job_id])


# ── Study Concepts ────────────────────────────────────────────

class StudyConcept(Base):
    __tablename__ = "study_concepts"
    __table_args__ = (
        Index("ix_sc_topic", "topic"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    topic = Column(String(255), nullable=False)
    concept = Column(String(500), nullable=False)
    explanation = Column(Text)
    examples = Column(Text)
    confidence = Column(Integer, default=0)  # 0-5
    last_reviewed_at = Column(DateTime)
    review_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── User Profile ─────────────────────────────────────────────

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    location = Column(String(255))
    linkedin_url = Column(String(500))
    portfolio_url = Column(String(500))
    github_url = Column(String(500))
    # Auto-apply fields
    work_authorization = Column(String(100))  # "US Citizen", "Green Card", "H1B", etc.
    require_sponsorship = Column(Boolean, default=False)
    years_experience = Column(Integer)
    desired_salary = Column(String(100))
    willing_to_relocate = Column(Boolean, default=False)
    preferred_locations = Column(Text)  # comma-separated
    # Education summary for quick form fills
    education_summary = Column(Text)
    # Diversity fields (optional, for EEO forms)
    gender = Column(String(50))
    ethnicity = Column(String(100))
    veteran_status = Column(String(50))
    disability_status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ── Resume ───────────────────────────────────────────────────

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False, default="Master Resume")
    content = Column(Text, nullable=False)  # Markdown format
    is_master = Column(Boolean, default=False)  # The canonical base resume
    parent_id = Column(GUID, ForeignKey("resumes.id"), nullable=True)  # Tailored from
    job_id = Column(GUID, ForeignKey("jobs.id"), nullable=True)  # Tailored for this job
    version = Column(Integer, default=1)
    edit_history = Column(JSONType, default=list)  # [{prompt, timestamp, changes_summary}]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    job = relationship("Job", foreign_keys=[job_id])


# ── Application Draft ────────────────────────────────────────

class ApplicationDraft(Base):
    __tablename__ = "application_drafts"
    __table_args__ = (
        Index("ix_app_draft_job", "job_id"),
        Index("ix_app_draft_status", "status"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID, ForeignKey("jobs.id"), nullable=False)
    resume_id = Column(GUID, ForeignKey("resumes.id"), nullable=True)
    cover_letter = Column(Text)
    tailored_summary = Column(Text)  # 2-3 line summary tailored to this role
    match_score = Column(Float)  # 0-100
    match_analysis = Column(Text)  # Detailed gap/strength analysis
    key_talking_points = Column(JSONType, default=list)  # Bullet points for interview
    status = Column(String(50), default="draft", nullable=False)  # draft, ready, approved, applied, withdrawn
    applied_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    job = relationship("Job", foreign_keys=[job_id])
    resume = relationship("Resume", foreign_keys=[resume_id])
