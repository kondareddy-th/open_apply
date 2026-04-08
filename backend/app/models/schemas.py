from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ── Companies ──────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    domain: str | None = None
    greenhouse_slug: str | None = None
    lever_slug: str | None = None
    ashby_slug: str | None = None
    workable_slug: str | None = None
    careers_url: str | None = None
    ats_type: str | None = None
    notes: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    greenhouse_slug: str | None = None
    lever_slug: str | None = None
    ashby_slug: str | None = None
    workable_slug: str | None = None
    careers_url: str | None = None
    ats_type: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CompanyOut(BaseModel):
    id: UUID
    name: str
    domain: str | None
    greenhouse_slug: str | None
    lever_slug: str | None
    ashby_slug: str | None
    workable_slug: str | None
    careers_url: str | None
    ats_type: str | None
    notes: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Jobs ───────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: UUID
    company_id: UUID
    company_name: str | None = None
    external_id: str
    source: str
    title: str
    department: str | None
    location: str | None
    description: str | None
    url: str | None
    match_score: float | None
    match_reasoning: str | None
    status: str
    user_notes: str | None = None
    bookmarked: bool = False
    posted_at: datetime | None
    scraped_at: datetime
    contact_count: int = 0

    model_config = {"from_attributes": True}


class JobStatusUpdate(BaseModel):
    status: str | None = None
    user_notes: str | None = None
    bookmarked: bool | None = None


# ── Contacts ───────────────────────────────────────────────────

class ContactOut(BaseModel):
    id: UUID
    job_id: UUID | None
    company_id: UUID | None
    company_name: str | None = None
    job_title: str | None = None
    name: str
    title: str | None
    linkedin_url: str | None
    email: str | None
    email_verified: bool
    source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContactUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    linkedin_url: str | None = None
    email: str | None = None


# ── Emails ─────────────────────────────────────────────────────

class EmailDraftRequest(BaseModel):
    contact_id: str
    job_id: str
    resume_context: str | None = None
    tone: str = "professional"


class EmailOut(BaseModel):
    id: UUID
    contact_id: UUID
    job_id: UUID
    contact_name: str | None = None
    contact_email: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    sequence_num: int
    subject: str
    body: str
    status: str
    gmail_message_id: str | None
    gmail_thread_id: str | None
    scheduled_at: datetime | None
    sent_at: datetime | None
    opened_at: datetime | None
    replied_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailUpdate(BaseModel):
    subject: str | None = None
    body: str | None = None


# ── Pipeline ───────────────────────────────────────────────────

class PipelineMetrics(BaseModel):
    total_companies: int = 0
    total_jobs: int = 0
    jobs_by_status: dict[str, int] = {}
    total_contacts: int = 0
    contacts_with_email: int = 0
    total_emails: int = 0
    emails_by_status: dict[str, int] = {}
    reply_count: int = 0


class PipelineConfigOut(BaseModel):
    key: str
    value: dict

    model_config = {"from_attributes": True}


class PipelineConfigUpdate(BaseModel):
    key: str
    value: dict


class ScrapeResult(BaseModel):
    company: str
    source: str
    jobs_found: int
    new_jobs: int


class DiscoverResult(BaseModel):
    job_title: str
    company: str
    contacts_found: int


# ── Interview Prep ────────────────────────────────────────────

class InterviewQuestionCreate(BaseModel):
    job_id: str | None = None
    category: str = "behavioral"
    question: str
    suggested_answer: str | None = None
    user_notes: str | None = None
    difficulty: str = "medium"


class InterviewQuestionUpdate(BaseModel):
    question: str | None = None
    suggested_answer: str | None = None
    user_notes: str | None = None
    difficulty: str | None = None
    confidence: int | None = None
    times_practiced: int | None = None
    last_practiced_at: datetime | None = None


class InterviewQuestionOut(BaseModel):
    id: UUID
    job_id: UUID | None
    category: str
    question: str
    suggested_answer: str | None
    user_notes: str | None
    difficulty: str
    confidence: int
    times_practiced: int
    last_practiced_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewPrepStats(BaseModel):
    total_questions: int = 0
    total_practiced: int = 0
    avg_confidence: float = 0.0
    by_category: dict[str, dict] = {}


class GenerateQuestionsRequest(BaseModel):
    count: int = 10


# ── Notes ─────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    job_id: str | None = None
    title: str
    content: str = ""
    tags: list[str] = []
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    pinned: bool | None = None


class NoteOut(BaseModel):
    id: UUID
    job_id: UUID | None
    title: str
    content: str
    tags: list[str]
    pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Study Concepts ────────────────────────────────────────────

class StudyConceptCreate(BaseModel):
    topic: str
    concept: str
    explanation: str | None = None
    examples: str | None = None


class StudyConceptUpdate(BaseModel):
    topic: str | None = None
    concept: str | None = None
    explanation: str | None = None
    examples: str | None = None
    confidence: int | None = None
    last_reviewed_at: datetime | None = None
    review_count: int | None = None


class StudyConceptOut(BaseModel):
    id: UUID
    topic: str
    concept: str
    explanation: str | None
    examples: str | None
    confidence: int
    last_reviewed_at: datetime | None
    review_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TopicSummary(BaseModel):
    topic: str
    count: int
    avg_confidence: float


class GenerateConceptsRequest(BaseModel):
    topic: str
    count: int = 8


# ── User Profile ─────────────────────────────────────────────

class UserProfileCreate(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    github_url: str | None = None
    work_authorization: str | None = None
    require_sponsorship: bool = False
    years_experience: int | None = None
    desired_salary: str | None = None
    willing_to_relocate: bool = False
    preferred_locations: str | None = None
    education_summary: str | None = None
    gender: str | None = None
    ethnicity: str | None = None
    veteran_status: str | None = None
    disability_status: str | None = None


class UserProfileOut(BaseModel):
    id: UUID
    full_name: str
    email: str | None
    phone: str | None
    location: str | None
    linkedin_url: str | None
    portfolio_url: str | None
    github_url: str | None
    work_authorization: str | None
    require_sponsorship: bool
    years_experience: int | None
    desired_salary: str | None
    willing_to_relocate: bool
    preferred_locations: str | None
    education_summary: str | None
    gender: str | None
    ethnicity: str | None
    veteran_status: str | None
    disability_status: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Resume ───────────────────────────────────────────────────

class ResumeCreate(BaseModel):
    title: str = "Master Resume"
    content: str
    is_master: bool = False


class ResumeEditRequest(BaseModel):
    instruction: str  # Natural language edit instruction


class ResumeTailorRequest(BaseModel):
    job_id: str


class ResumeOut(BaseModel):
    id: UUID
    title: str
    content: str
    is_master: bool
    parent_id: UUID | None
    job_id: UUID | None
    version: int
    edit_history: list[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Application Draft ────────────────────────────────────────

class ApplicationPrepRequest(BaseModel):
    job_id: str


class ApplicationDraftOut(BaseModel):
    id: UUID
    job_id: UUID
    resume_id: UUID | None
    cover_letter: str | None
    tailored_summary: str | None
    match_score: float | None
    match_analysis: str | None
    key_talking_points: list[dict]
    status: str
    applied_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    # Joined fields
    job_title: str | None = None
    company_name: str | None = None
    job_url: str | None = None

    model_config = {"from_attributes": True}


class ApplicationStatusUpdate(BaseModel):
    status: str
    notes: str | None = None


class RoleMatchRequest(BaseModel):
    sample_jd: str | None = None  # Find roles matching this JD
    use_resume: bool = True  # Also consider user's resume for matching
