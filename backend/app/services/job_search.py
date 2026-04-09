"""Job search service — search across ATS boards by keywords.

Searches ATS APIs directly (fast, reliable) instead of going through web search.
Supports: Greenhouse API, Lever API, Ashby API.
"""

import asyncio
import logging
import re

import httpx

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Well-known company slugs for each board (quick lookup)
GREENHOUSE_COMPANIES = {
    "anthropic", "vercel", "stripe", "figma", "airtable", "temporal",
    "runpod", "gleanwork", "runwayml", "hightouch", "celonis", "n26",
    "sumup", "wayve", "stabilityai", "speechmatics", "scandit",
    "contentful", "hellofresh", "getyourguide", "blackforestlabs",
    "helsing", "intercom", "humeai", "polyai", "parloa", "amplemarket",
    "physicsx", "isomorphiclabs", "arizeai", "traderepublicbank", "factorial",
}

LEVER_COMPANIES = {
    "mistral", "spotify", "wandb", "palantir", "qonto", "forto",
    "vinted", "pigment",
}

ASHBY_COMPANIES = {
    "elevenlabs", "deepgram", "perplexity", "cohere", "langchain",
    "pinecone", "zapier", "n8n", "lovable", "legora", "synthesia",
    "faculty", "causaly", "attio", "tinybird", "lakera.ai", "cradlebio",
    "sierra", "decagon", "lindy", "claylabs", "workos", "photoroom",
    "vapi", "bland", "retool", "DeepL", "AlephAlpha", "travelperk",
}


async def search_jobs_by_keyword(
    keywords: str,
    company: str | None = None,
    boards: list[str] | None = None,
    max_results: int = 50,
    date_days: int | None = None,
) -> list[dict]:
    """Search for jobs across ATS boards using keywords.

    Searches ATS APIs directly — fast and reliable.
    """
    if not boards:
        boards = ["greenhouse", "lever", "ashby"]

    results = []
    tasks = []

    # If company is specified, search just that company
    if company:
        company_lower = company.lower().replace(" ", "")
        for board in boards:
            if board == "greenhouse":
                # Try the company as a greenhouse slug
                slug = _guess_slug(company, GREENHOUSE_COMPANIES)
                if slug:
                    tasks.append(_search_greenhouse(slug, keywords, max_results))
            elif board == "lever":
                slug = _guess_slug(company, LEVER_COMPANIES)
                if slug:
                    tasks.append(_search_lever(slug, keywords, max_results))
            elif board == "ashby":
                slug = _guess_slug(company, ASHBY_COMPANIES)
                if slug:
                    tasks.append(_search_ashby(slug, keywords, max_results))
    else:
        # Search across top companies on each board
        per_board = max(max_results // len(boards), 10)
        for board in boards:
            if board == "greenhouse":
                # Search top 5 greenhouse companies
                for slug in list(GREENHOUSE_COMPANIES)[:5]:
                    tasks.append(_search_greenhouse(slug, keywords, per_board // 5 + 5))
            elif board == "lever":
                for slug in list(LEVER_COMPANIES)[:4]:
                    tasks.append(_search_lever(slug, keywords, per_board // 4 + 5))
            elif board == "ashby":
                for slug in list(ASHBY_COMPANIES)[:5]:
                    tasks.append(_search_ashby(slug, keywords, per_board // 5 + 5))

    if tasks:
        # Run all searches in parallel with a timeout
        board_results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in board_results:
            if isinstance(result, list):
                results.extend(result)

    # Deduplicate by URL
    seen = set()
    unique = []
    for r in results:
        url_key = r.get("url", "").split("?")[0]
        if url_key and url_key not in seen:
            seen.add(url_key)
            unique.append(r)

    return unique[:max_results]


def _guess_slug(company: str, known_slugs: set) -> str | None:
    """Try to find a matching slug for a company name."""
    company_lower = company.lower().strip()
    # Exact match
    if company_lower in known_slugs:
        return company_lower
    # Try without spaces
    no_space = company_lower.replace(" ", "")
    if no_space in known_slugs:
        return no_space
    # Try partial match
    for slug in known_slugs:
        if company_lower in slug or slug in company_lower:
            return slug
    # Return the raw input as a slug attempt
    return company_lower.replace(" ", "").replace(".", "")


async def _search_greenhouse(slug: str, keywords: str, limit: int) -> list[dict]:
    """Search Greenhouse API for a specific company."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()

        kw_lower = [k.lower() for k in keywords.split()] if keywords else []
        results = []
        for item in data.get("jobs", []):
            title = item.get("title", "")
            # Filter by keywords if provided
            if kw_lower and not any(kw in title.lower() for kw in kw_lower):
                continue
            location = item.get("location", {})
            loc_name = location.get("name") if isinstance(location, dict) else None
            results.append({
                "title": title,
                "company": slug.replace("-", " ").title(),
                "url": item.get("absolute_url", ""),
                "source": "greenhouse",
                "location": loc_name,
                "department": (item.get("departments", [{}])[0].get("name") if item.get("departments") else None),
                "posted_at": item.get("updated_at"),
            })
            if len(results) >= limit:
                break

        return results
    except Exception as e:
        logger.warning("Greenhouse search failed for %s: %s", slug, e)
        return []


async def _search_lever(slug: str, keywords: str, limit: int) -> list[dict]:
    """Search Lever API for a specific company."""
    url = f"https://api.lever.co/v0/postings/{slug}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()

        kw_lower = [k.lower() for k in keywords.split()] if keywords else []
        results = []
        for item in data:
            title = item.get("text", "")
            if kw_lower and not any(kw in title.lower() for kw in kw_lower):
                continue
            categories = item.get("categories", {})
            results.append({
                "title": title,
                "company": slug.replace("-", " ").title(),
                "url": item.get("hostedUrl", ""),
                "source": "lever",
                "location": categories.get("location"),
                "department": categories.get("department"),
            })
            if len(results) >= limit:
                break

        return results
    except Exception as e:
        logger.warning("Lever search failed for %s: %s", slug, e)
        return []


async def _search_ashby(slug: str, keywords: str, limit: int) -> list[dict]:
    """Search Ashby API for a specific company."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=_HEADERS)
            if resp.status_code != 200:
                return []
            data = resp.json()

        kw_lower = [k.lower() for k in keywords.split()] if keywords else []
        results = []
        for item in data.get("jobs", []):
            title = item.get("title", "")
            if kw_lower and not any(kw in title.lower() for kw in kw_lower):
                continue
            location = item.get("location") or item.get("locationName")
            if isinstance(location, dict):
                location = location.get("name")
            results.append({
                "title": title,
                "company": slug.replace("-", " ").title(),
                "url": item.get("jobUrl", f"https://jobs.ashbyhq.com/{slug}/{item.get('id', '')}"),
                "source": "ashby",
                "location": location,
                "department": item.get("department") or item.get("team"),
            })
            if len(results) >= limit:
                break

        return results
    except Exception as e:
        logger.warning("Ashby search failed for %s: %s", slug, e)
        return []
