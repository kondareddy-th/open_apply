import json
import logging

from app.services.claude import _call_claude, strip_json_fences

logger = logging.getLogger(__name__)

GENERATE_QUESTIONS_SYSTEM = """You are an expert career coach and interview preparation specialist.
Generate interview questions for the given job position. Return a JSON array of question objects.

Each question must have:
- "category": one of "behavioral", "technical", "system_design", "company_specific"
- "question": the interview question text
- "suggested_answer": a detailed suggested answer (use STAR format for behavioral questions)
- "difficulty": one of "easy", "medium", "hard"

Mix categories appropriately based on the role. For technical roles, include more technical and system design questions.
For non-technical roles, focus more on behavioral and company-specific questions.
Return ONLY valid JSON array, no markdown fences or extra text."""

GENERATE_CONCEPTS_SYSTEM = """You are an expert technical educator and interview coach.
Break down the given topic into key concepts that someone should understand for interviews.
Return a JSON array of concept objects.

Each concept must have:
- "concept": short name/title of the concept
- "explanation": clear, concise explanation (2-4 paragraphs)
- "examples": practical examples, code snippets, or scenarios (use markdown formatting)

Return ONLY valid JSON array, no markdown fences or extra text."""


async def generate_interview_questions(
    job_title: str,
    company_name: str,
    job_description: str | None,
    api_key: str,
    count: int = 10,
) -> list[dict]:
    """Use Claude to generate interview questions for a specific job."""
    user_msg = f"Generate {count} interview questions for:\n\n"
    user_msg += f"Position: {job_title}\n"
    user_msg += f"Company: {company_name}\n"
    if job_description:
        user_msg += f"\nJob Description:\n{job_description[:3000]}\n"

    try:
        response = await _call_claude(
            system=GENERATE_QUESTIONS_SYSTEM,
            user_message=user_msg,
            api_key=api_key,
            max_tokens=8192,
        )
        questions = json.loads(strip_json_fences(response))
        if isinstance(questions, list):
            return questions
        return []
    except Exception as e:
        logger.error(f"Failed to generate questions: {e}")
        return []


async def generate_study_concepts(
    topic: str,
    api_key: str,
    count: int = 8,
) -> list[dict]:
    """Use Claude to generate concept breakdowns for a study topic."""
    user_msg = f"Break down the topic '{topic}' into {count} key concepts for interview preparation."

    try:
        response = await _call_claude(
            system=GENERATE_CONCEPTS_SYSTEM,
            user_message=user_msg,
            api_key=api_key,
            max_tokens=8192,
        )
        concepts = json.loads(strip_json_fences(response))
        if isinstance(concepts, list):
            return concepts
        return []
    except Exception as e:
        logger.error(f"Failed to generate concepts: {e}")
        return []
