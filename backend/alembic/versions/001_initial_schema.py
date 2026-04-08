"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-02-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255)),
        sa.Column("greenhouse_slug", sa.String(255)),
        sa.Column("lever_slug", sa.String(255)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("department", sa.String(255)),
        sa.Column("location", sa.String(500)),
        sa.Column("description", sa.Text),
        sa.Column("url", sa.String(1000)),
        sa.Column("match_score", sa.Float),
        sa.Column("match_reasoning", sa.Text),
        sa.Column("status", sa.String(50), nullable=False, server_default="new"),
        sa.Column("posted_at", sa.DateTime),
        sa.Column("scraped_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source", "external_id", name="uq_job_source_external"),
    )
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_company", "jobs", ["company_id"])

    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255)),
        sa.Column("linkedin_url", sa.String(1000)),
        sa.Column("email", sa.String(255)),
        sa.Column("email_verified", sa.Boolean, server_default="false"),
        sa.Column("source", sa.String(100)),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("sequence_num", sa.Integer, nullable=False, server_default="1"),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("gmail_message_id", sa.String(255)),
        sa.Column("gmail_thread_id", sa.String(255)),
        sa.Column("scheduled_at", sa.DateTime),
        sa.Column("sent_at", sa.DateTime),
        sa.Column("opened_at", sa.DateTime),
        sa.Column("replied_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "email_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("emails.id"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "pipeline_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(255), unique=True, nullable=False),
        sa.Column("value", postgresql.JSONB, server_default="{}"),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("pipeline_config")
    op.drop_table("email_events")
    op.drop_table("emails")
    op.drop_table("contacts")
    op.drop_table("jobs")
    op.drop_table("companies")
