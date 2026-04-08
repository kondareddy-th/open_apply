"""Unified LLM service supporting both Anthropic (Claude) and OpenAI.

The provider is determined per-request:
  1. X-Anthropic-Key header → uses Claude
  2. X-OpenAI-Key header → uses OpenAI
  3. Falls back to env vars (ANTHROPIC_API_KEY / OPENAI_API_KEY)
  4. Falls back to settings.llm_provider default

All internal callers use _call_claude() and parse_json_safe() — the function
name is historical, it now routes to whichever provider the user configured.
"""

import base64
import json
import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)


def _get_anthropic_client(api_key: str):
    from anthropic import AsyncAnthropic
    return AsyncAnthropic(api_key=api_key)


def _get_openai_client(api_key: str):
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=api_key)


def _detect_provider(api_key: str) -> str:
    """Detect which LLM provider to use based on the API key format."""
    if api_key.startswith("sk-ant-"):
        return "anthropic"
    if api_key.startswith("sk-") and not api_key.startswith("sk-ant-"):
        return "openai"
    return settings.llm_provider


async def _call_claude(
    system: str,
    user_message: str,
    api_key: str,
    max_tokens: int = 4096,
    model: str | None = None,
) -> str:
    """Call the configured LLM (Claude or OpenAI) with a system + user message."""
    provider = _detect_provider(api_key)

    if provider == "openai":
        return await _call_openai(system, user_message, api_key, max_tokens, model)

    # Default: Anthropic
    client = _get_anthropic_client(api_key)
    message = await client.messages.create(
        model=model or settings.claude_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )
    return message.content[0].text


async def _call_openai(
    system: str,
    user_message: str,
    api_key: str,
    max_tokens: int = 4096,
    model: str | None = None,
) -> str:
    """Call OpenAI with a system + user message."""
    client = _get_openai_client(api_key)
    response = await client.chat.completions.create(
        model=model or settings.openai_model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""


async def _call_claude_vision(
    system: str,
    text_message: str,
    image_data: bytes,
    api_key: str,
    max_tokens: int = 4096,
    model: str | None = None,
    media_type: str = "image/png",
) -> str:
    """Call Claude with both text and an image (vision). Anthropic only."""
    client = _get_anthropic_client(api_key)
    b64_data = base64.b64encode(image_data).decode("utf-8")

    message = await client.messages.create(
        model=model or settings.claude_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64_data,
                    },
                },
                {
                    "type": "text",
                    "text": text_message,
                },
            ],
        }],
    )
    return message.content[0].text


def strip_json_fences(text: str) -> str:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text)
    if match:
        return match.group(1)
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def parse_json_safe(text: str, fallback: dict | None = None) -> dict:
    try:
        return json.loads(strip_json_fences(text))
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse LLM JSON response")
        return fallback or {}
