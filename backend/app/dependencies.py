import uuid as _uuid

from fastapi import Request, HTTPException

from app.config import settings


def parse_uuid(value: str) -> _uuid.UUID:
    """Parse a string to UUID, raising 422 if invalid."""
    try:
        return _uuid.UUID(value)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail=f"Invalid ID format: {value}")

ALLOWED_CLAUDE_MODELS = {
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-6-20250929",
    "claude-opus-4-6-20250929",
}

ALLOWED_OPENAI_MODELS = {
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o3-mini",
}


def get_api_key(request: Request) -> str:
    """Extract LLM API key from request headers or env vars.

    Checks (in order):
    1. X-Anthropic-Key header
    2. X-OpenAI-Key header
    3. ANTHROPIC_API_KEY env var
    4. OPENAI_API_KEY env var
    """
    key = request.headers.get("X-Anthropic-Key", "")
    if key:
        return key

    key = request.headers.get("X-OpenAI-Key", "")
    if key:
        return key

    if settings.anthropic_api_key:
        return settings.anthropic_api_key

    if settings.openai_api_key:
        return settings.openai_api_key

    raise HTTPException(
        status_code=401,
        detail="API key required. Set an Anthropic or OpenAI key in Settings.",
    )


def get_claude_model(request: Request) -> str:
    """Get the model to use — supports both Claude and OpenAI model IDs."""
    model = request.headers.get("X-Claude-Model", "")
    if model and model in ALLOWED_CLAUDE_MODELS:
        return model
    if model and model in ALLOWED_OPENAI_MODELS:
        return model

    # Check if using OpenAI key → default to OpenAI model
    key = request.headers.get("X-OpenAI-Key", "")
    if key or (not settings.anthropic_api_key and settings.openai_api_key):
        return settings.openai_model

    return settings.claude_model
