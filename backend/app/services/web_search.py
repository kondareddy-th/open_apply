"""
Web search module using DuckDuckGo.

Used by contact_finder.py for hiring manager discovery.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)

_last_ddg_call = 0.0
_DDG_MIN_INTERVAL = 2.0  # seconds between DuckDuckGo calls


async def web_search(query: str, num: int = 10) -> list[dict]:
    """
    Search the web using DuckDuckGo.
    Returns list of dicts with keys: title, link, snippet
    """
    import time
    from duckduckgo_search import DDGS

    global _last_ddg_call
    now = time.monotonic()
    wait = _DDG_MIN_INTERVAL - (now - _last_ddg_call)
    if wait > 0:
        await asyncio.sleep(wait)

    def _sync_search() -> list[dict]:
        global _last_ddg_call
        results = []
        for attempt in range(3):
            try:
                ddgs = DDGS()
                for r in ddgs.text(query, max_results=num):
                    results.append({
                        "title": r.get("title", ""),
                        "link": r.get("href", ""),
                        "snippet": r.get("body", ""),
                    })
                _last_ddg_call = time.monotonic()
                return results
            except Exception as e:
                if "Ratelimit" in str(e) and attempt < 2:
                    import time as t
                    t.sleep(3 * (attempt + 1))
                    continue
                logger.warning("DuckDuckGo search failed: %s", e)
                break
        _last_ddg_call = time.monotonic()
        return results

    return await asyncio.to_thread(_sync_search)
