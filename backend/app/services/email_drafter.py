import logging

from app.prompts import EMAIL_DRAFTER_SYSTEM, JOB_MATCHER_SYSTEM
from app.services.claude import _call_claude, parse_json_safe

logger = logging.getLogger(__name__)


async def draft_email(
    contact_name: str,
    contact_title: str,
    company_name: str,
    job_title: str,
    job_description: str | None,
    resume_context: str | None,
    tone: str,
    api_key: str,
    model: str | None = None,
) -> dict:
    """Generate a personalized cold email using Claude."""
    prompt = f"""Write a cold outreach email for this scenario:

Recipient: {contact_name}, {contact_title} at {company_name}
Target Role: {job_title}

{f"Job Description Summary: {job_description[:1000]}" if job_description else ""}

{f"About the Candidate: {resume_context}" if resume_context else ""}

Tone: {tone}

Generate a personalized, specific email. Reference the company and role directly.
Return JSON with "subject" and "body" keys."""

    raw = await _call_claude(EMAIL_DRAFTER_SYSTEM, prompt, api_key, max_tokens=1024, model=model)
    result = parse_json_safe(raw, {"subject": "Regarding the role", "body": raw[:500]})
    return result


async def score_job_match(
    job_title: str,
    job_description: str | None,
    company_name: str,
    criteria: str,
    api_key: str,
    model: str | None = None,
) -> dict:
    """Score how well a job matches the user's criteria."""
    prompt = f"""Score this job for relevance:

Company: {company_name}
Job Title: {job_title}
{f"Description: {job_description[:2000]}" if job_description else ""}

Candidate Criteria: {criteria}

Return JSON with "score" (0-100) and "reasoning" keys."""

    raw = await _call_claude(JOB_MATCHER_SYSTEM, prompt, api_key, max_tokens=512, model=model)
    result = parse_json_safe(raw, {"score": 0, "reasoning": "Failed to score"})
    return result
