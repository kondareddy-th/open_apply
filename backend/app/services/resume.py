"""Resume service — Claude-powered resume management.

Handles:
- Natural language resume editing ("make my experience section more concise")
- Resume tailoring for specific job descriptions
- Cover letter generation
- Match analysis (resume vs job)
- Application preparation (tailored resume + cover letter + talking points)
"""

import logging
from datetime import datetime

from app.services.claude import _call_claude, parse_json_safe

logger = logging.getLogger(__name__)

# ── System Prompts ───────────────────────────────────────────

RESUME_EDITOR_SYSTEM = """You are an expert resume editor. The user will give you their current resume in markdown and a natural language instruction for how to modify it.

Apply the requested changes and return the FULL updated resume in markdown format.

Rules:
- Preserve the overall structure unless asked to change it
- Keep it professional and ATS-friendly
- Use action verbs, quantify achievements where possible
- Never invent metrics or experiences — only reword/restructure existing content
- If the instruction is unclear, make your best judgment and note what you changed

Return a JSON object:
{
  "resume": "full updated resume in markdown",
  "changes_summary": "brief description of what was changed"
}

Return ONLY valid JSON."""

RESUME_TAILOR_SYSTEM = """You are an expert resume strategist. Given a master resume and a job description, create a tailored version that maximizes the candidate's chances for THIS specific role.

Strategy:
1. Reorder bullet points to lead with the most relevant experience
2. Mirror key terminology from the JD (ATS optimization)
3. Emphasize skills and achievements that align with the role's requirements
4. Adjust the professional summary to speak directly to the role
5. De-emphasize or condense irrelevant experience (but don't remove it)
6. NEVER invent experience, skills, or metrics — only reframe existing content

Return a JSON object:
{
  "resume": "full tailored resume in markdown",
  "changes_summary": "what was adjusted and why",
  "keywords_matched": ["list", "of", "JD", "keywords", "that", "appear", "in", "resume"],
  "keywords_missing": ["JD", "keywords", "NOT", "in", "resume"]
}

Return ONLY valid JSON."""

MATCH_ANALYSIS_SYSTEM = """You are a career advisor analyzing how well a resume matches a job posting.

Provide a thorough analysis including:
1. Overall match score (0-100)
2. Key strengths — what the candidate brings that the role needs
3. Gaps — what the JD asks for that the resume doesn't show
4. Suggestions — concrete ways to improve the match
5. Key talking points — 3-5 bullet points the candidate should emphasize in an interview

Return a JSON object:
{
  "score": 75,
  "summary": "one paragraph overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "gaps": ["gap 1", "gap 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "talking_points": ["point 1", "point 2", "point 3"]
}

Return ONLY valid JSON."""

COVER_LETTER_SYSTEM = """You are an expert at writing compelling, personalized cover letters.

Rules:
- Under 300 words
- Opening: hook that shows you understand the company/role
- Middle: 2-3 specific examples from the resume that map to JD requirements
- Close: clear call to action, enthusiasm without being generic
- Tone: professional but human, never corporate-speak
- Never start with "I am writing to express my interest" or similar cliches
- Reference specific things from the JD and company
- Show, don't tell — use evidence from the resume

Return ONLY the cover letter text, no JSON wrapping."""

ROLE_MATCHER_SYSTEM = """You are a career advisor. Given either a resume, a sample job description, or both, score a list of job postings for relevance.

For each job, provide:
- score (0-100): how well the candidate/criteria matches
- reasoning: 1-2 sentence explanation

Return a JSON object:
{
  "results": [
    {"job_index": 0, "score": 85, "reasoning": "Strong match — ..."},
    {"job_index": 1, "score": 42, "reasoning": "Partial match — ..."}
  ]
}

Return ONLY valid JSON."""

RESUME_PARSER_SYSTEM = """You are a resume parser. Given raw text (possibly pasted from a PDF or LinkedIn), convert it into clean, well-structured markdown.

Use this structure:
# [Full Name]

**[Title/Headline]** | [Location] | [Email] | [Phone]

## Professional Summary
[2-3 sentences]

## Experience
### [Title] — [Company]
*[Date range]* | [Location]
- Achievement bullet
- Achievement bullet

### [Title] — [Company]
...

## Education
### [Degree] — [School]
*[Year]*

## Skills
[Comma-separated list]

Rules:
- Extract ALL information from the input, don't skip anything
- Use markdown formatting consistently
- Quantify achievements where the data is present
- Don't invent or embellish

Return a JSON object:
{
  "resume": "the full markdown resume",
  "detected_name": "candidate's full name",
  "detected_title": "most recent/primary job title"
}

Return ONLY valid JSON."""


# ── Core Functions ───────────────────────────────────────────

async def edit_resume(
    current_content: str,
    instruction: str,
    api_key: str,
    model: str | None = None,
) -> dict:
    """Apply a natural language edit to a resume."""
    prompt = f"""Here is the current resume:

```markdown
{current_content}
```

User's instruction: {instruction}

Apply the changes and return the updated resume as JSON."""

    raw = await _call_claude(RESUME_EDITOR_SYSTEM, prompt, api_key, max_tokens=8192, model=model)
    result = parse_json_safe(raw, {"resume": current_content, "changes_summary": "No changes applied"})
    return result


async def tailor_resume(
    master_content: str,
    job_title: str,
    company_name: str,
    job_description: str | None,
    api_key: str,
    model: str | None = None,
) -> dict:
    """Create a tailored resume for a specific job."""
    jd_section = f"\n\nJob Description:\n{job_description[:3000]}" if job_description else ""

    prompt = f"""Master Resume:

```markdown
{master_content}
```

Target Role: {job_title} at {company_name}{jd_section}

Tailor this resume for the target role. Return as JSON."""

    raw = await _call_claude(RESUME_TAILOR_SYSTEM, prompt, api_key, max_tokens=8192, model=model)
    result = parse_json_safe(raw, {
        "resume": master_content,
        "changes_summary": "No changes",
        "keywords_matched": [],
        "keywords_missing": [],
    })
    return result


async def analyze_match(
    resume_content: str,
    job_title: str,
    company_name: str,
    job_description: str | None,
    api_key: str,
    model: str | None = None,
) -> dict:
    """Analyze how well a resume matches a job posting."""
    jd_section = f"\n\nJob Description:\n{job_description[:3000]}" if job_description else f"\n\nJob Title: {job_title} at {company_name}"

    prompt = f"""Resume:

```markdown
{resume_content}
```
{jd_section}

Analyze the match between this resume and the job. Return as JSON."""

    raw = await _call_claude(MATCH_ANALYSIS_SYSTEM, prompt, api_key, max_tokens=4096, model=model)
    result = parse_json_safe(raw, {
        "score": 0,
        "summary": "Unable to analyze",
        "strengths": [],
        "gaps": [],
        "suggestions": [],
        "talking_points": [],
    })
    return result


async def generate_cover_letter(
    resume_content: str,
    job_title: str,
    company_name: str,
    job_description: str | None,
    api_key: str,
    model: str | None = None,
) -> str:
    """Generate a cover letter for a specific role."""
    jd_section = f"\n\nJob Description:\n{job_description[:3000]}" if job_description else ""

    prompt = f"""Resume:

```markdown
{resume_content}
```

Target Role: {job_title} at {company_name}{jd_section}

Write a compelling cover letter for this role."""

    return await _call_claude(COVER_LETTER_SYSTEM, prompt, api_key, max_tokens=2048, model=model)


async def parse_resume(
    raw_text: str,
    api_key: str,
    model: str | None = None,
) -> dict:
    """Parse raw resume text into structured markdown."""
    prompt = f"""Parse this resume into clean markdown:

{raw_text[:5000]}"""

    raw = await _call_claude(RESUME_PARSER_SYSTEM, prompt, api_key, max_tokens=8192, model=model)
    result = parse_json_safe(raw, {
        "resume": raw_text,
        "detected_name": "",
        "detected_title": "",
    })
    return result


async def score_jobs_for_resume(
    resume_content: str | None,
    sample_jd: str | None,
    jobs: list[dict],
    api_key: str,
    model: str | None = None,
) -> list[dict]:
    """Score a batch of jobs against a resume and/or sample JD."""
    context_parts = []
    if resume_content:
        context_parts.append(f"Candidate's Resume:\n```markdown\n{resume_content[:2000]}\n```")
    if sample_jd:
        context_parts.append(f"Sample JD (find similar roles):\n{sample_jd[:1500]}")
    context = "\n\n".join(context_parts)

    # Format jobs for scoring
    job_list = []
    for i, j in enumerate(jobs[:20]):  # Cap at 20 for token limits
        jd_snippet = f"\nDescription: {j.get('description', '')[:300]}" if j.get('description') else ""
        job_list.append(f"Job {i}: {j['title']} at {j.get('company_name', 'Unknown')}"
                       f"\nLocation: {j.get('location', 'N/A')}{jd_snippet}")

    prompt = f"""{context}

Score these jobs for relevance:

{chr(10).join(job_list)}

Return scores as JSON."""

    raw = await _call_claude(ROLE_MATCHER_SYSTEM, prompt, api_key, max_tokens=4096, model=model)
    result = parse_json_safe(raw, {"results": []})
    return result.get("results", [])
