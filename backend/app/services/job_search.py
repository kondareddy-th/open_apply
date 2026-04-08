"""Job search service — search across ATS boards by keywords.

Allows users to search Greenhouse, Ashby boards without pre-configuring companies.
Uses DuckDuckGo site-restricted search to find matching job postings.
"""

import asyncio
import logging
import re

from app.services.web_search import web_search

logger = logging.getLogger(__name__)


async def search_jobs_by_keyword(
    keywords: str,
    boards: list[str] | None = None,
    max_results: int = 20,
) -> list[dict]:
    """Search for jobs across ATS boards using keywords.

    Uses DuckDuckGo site: queries to search Greenhouse, Lever, Ashby, Workable.
    Returns list of {title, company, url, source, location}.
    """
    if not boards:
        boards = ["greenhouse", "lever", "ashby", "workable"]

    site_queries = {
        "greenhouse": f'site:job-boards.greenhouse.io OR site:boards.greenhouse.io "{keywords}"',
        "lever": f'site:jobs.lever.co "{keywords}"',
        "ashby": f'site:jobs.ashbyhq.com "{keywords}"',
        "workable": f'site:apply.workable.com "{keywords}"',
    }

    all_results = []
    tasks = []

    for board in boards:
        if board in site_queries:
            tasks.append(_search_board(board, site_queries[board], max_results // len(boards)))

    if tasks:
        board_results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in board_results:
            if isinstance(result, list):
                all_results.extend(result)

    # Deduplicate by URL
    seen = set()
    unique = []
    for r in all_results:
        url_key = r.get("url", "").split("?")[0]
        if url_key and url_key not in seen:
            seen.add(url_key)
            unique.append(r)

    return unique[:max_results]


async def _search_board(board: str, query: str, limit: int) -> list[dict]:
    """Search a single board via DuckDuckGo."""
    try:
        results = await web_search(query, num=limit)
        parsed = []

        for item in results:
            title, company = _parse_search_result(item.get("title", ""), item.get("link", ""), board)
            if title:
                parsed.append({
                    "title": title,
                    "company": company,
                    "url": item.get("link", ""),
                    "source": board,
                    "snippet": item.get("snippet", ""),
                })

        return parsed
    except Exception as e:
        logger.warning("Board search failed for %s: %s", board, e)
        return []


def _parse_search_result(title: str, url: str, board: str) -> tuple[str, str]:
    """Extract job title and company from a search result."""
    # Common patterns:
    # "Senior AI Engineer at Anthropic" (Greenhouse)
    # "Senior AI Engineer — Anthropic" (Lever)
    # "Senior AI PM (Remote) @ EverAI" (Ashby)

    # Try regex patterns
    patterns = [
        r"^(.+?)\s+at\s+(.+?)(?:\s*[-|]|$)",
        r"^(.+?)\s*[@—–-]\s*(.+?)(?:\s*[-|]|$)",
        r"^(.+?)\s*\|\s*(.+?)$",
    ]

    for pattern in patterns:
        match = re.match(pattern, title, re.IGNORECASE)
        if match:
            job_title = match.group(1).strip()
            company = match.group(2).strip()
            # Clean up
            company = re.sub(r"\s*[-|]?\s*LinkedIn$", "", company)
            company = re.sub(r"\s*[-|]?\s*Greenhouse$", "", company)
            company = re.sub(r"\s*[-|]?\s*Lever$", "", company)
            return job_title, company

    # Fallback: try to extract company from URL
    company = _company_from_url(url, board)
    # Use full title as job title
    clean_title = re.sub(r"\s*[-|]\s*(Greenhouse|Lever|Ashby|Workable).*$", "", title).strip()
    return clean_title, company


def _company_from_url(url: str, board: str) -> str:
    """Extract company name/slug from ATS URL."""
    if board == "greenhouse":
        match = re.search(r"greenhouse\.io/([^/]+)", url)
        return match.group(1).replace("-", " ").title() if match else ""
    elif board == "lever":
        match = re.search(r"lever\.co/([^/]+)", url)
        return match.group(1).replace("-", " ").title() if match else ""
    elif board == "ashby":
        match = re.search(r"ashbyhq\.com/([^/]+)", url)
        return match.group(1).replace("-", " ").title() if match else ""
    elif board == "workable":
        match = re.search(r"workable\.com/([^/]+)", url)
        return match.group(1).replace("-", " ").title() if match else ""
    return ""
