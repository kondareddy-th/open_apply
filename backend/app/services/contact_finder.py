"""Contact finder — discovers hiring contacts at companies.

Priority chain (no LinkedIn dependency):
1. Claude AI analysis — uses job description + company info to identify likely contacts
2. DuckDuckGo web search — finds hiring managers, recruiters via public search
3. Company team page scraping — extracts people from /team or /about pages

Email inference: generates candidate addresses from name + company domain.
"""

import asyncio
import logging
import re

import dns.resolver

from app.services.web_search import web_search
from app.services.claude import _call_claude, parse_json_safe

logger = logging.getLogger(__name__)

ALL_CONTACT_SOURCES = {"web_search", "ai_analysis"}

TARGET_TITLES = [
    "Head of AI",
    "VP Engineering",
    "Engineering Manager",
    "Director of Engineering",
    "CTO",
    "Hiring Manager",
    "Technical Recruiter",
    "Head of Engineering",
    "Senior Engineering Manager",
    "Talent Acquisition",
    "People Operations",
]

CONTACT_FINDER_SYSTEM = """You are a hiring intelligence assistant. Given a job posting, identify the most likely people involved in the hiring process and their probable email addresses.

Return a JSON object with this structure:
{
  "contacts": [
    {
      "name": "Full Name",
      "title": "Their job title (e.g. Engineering Manager, Technical Recruiter)",
      "email": "likely email address or null",
      "reasoning": "Why this person is likely involved"
    }
  ],
  "email_pattern": "The company's likely email pattern (e.g. firstname.lastname@company.com)"
}

Guidelines:
- Focus on people who would actually be involved in hiring for THIS specific role
- For the email, use the company's domain and common patterns (firstname.lastname@, firstname@, first.last@)
- If you can identify specific names (from the job description, company leadership, etc.), include them
- If you cannot identify specific people, suggest the types of people to reach out to with generic entries
- Include 1-3 contacts maximum
- The email_pattern should reflect the company's likely format"""


async def search_contacts(
    company_name: str,
    domain: str | None = None,
    sources: set[str] | None = None,
    job_title: str | None = None,
    job_url: str | None = None,
    job_description: str | None = None,
    api_key: str | None = None,
    db=None,
) -> list[dict]:
    """Search for hiring contacts at a company.

    Priority chain:
    1. Claude AI analysis (fast, smart guessing based on job data)
    2. DuckDuckGo web search (public web, no auth needed)
    3. Company team page scraping (direct HTML)
    """
    contacts = []

    # PRIMARY: Claude text-based analysis
    if api_key and job_title:
        ai_contacts = await _find_contacts_with_claude(
            company_name=company_name,
            job_title=job_title,
            job_description=job_description,
            domain=domain,
            api_key=api_key,
        )
        contacts.extend(ai_contacts)
        if contacts:
            return _dedupe_contacts(contacts)

    # SECONDARY: Web search (DuckDuckGo)
    use_sources = sources or ALL_CONTACT_SOURCES
    try:
        web_results = await asyncio.wait_for(
            _web_search_contacts(company_name, domain, job_title, use_sources),
            timeout=30,
        )
        contacts.extend(web_results)
    except asyncio.TimeoutError:
        logger.warning("Web search contacts timed out after 30s")

    # TERTIARY: Company team page scraping
    if not contacts and domain:
        try:
            team_contacts = await asyncio.wait_for(
                _scrape_team_page(company_name, domain),
                timeout=15,
            )
            contacts.extend(team_contacts)
        except asyncio.TimeoutError:
            logger.warning("Team page scrape timed out")
        except Exception as e:
            logger.warning("Team page scrape failed: %s", e)

    return _dedupe_contacts(contacts)


async def _find_contacts_with_claude(
    company_name: str,
    job_title: str,
    job_description: str | None = None,
    domain: str | None = None,
    api_key: str = "",
) -> list[dict]:
    """Use Claude to identify likely hiring contacts from job data."""
    if not api_key:
        return []

    desc_snippet = ""
    if job_description:
        desc_snippet = f"\nJob Description (first 1500 chars):\n{job_description[:1500]}"

    domain_hint = f"\nCompany domain: {domain}" if domain else ""

    prompt = f"""Analyze this job posting and identify the most likely people involved in hiring:

Company: {company_name}
Job Title: {job_title}{domain_hint}{desc_snippet}

Who would likely be the hiring manager, recruiter, or team lead for this role?
What email addresses would they likely have?

Return your analysis as JSON."""

    try:
        raw = await _call_claude(CONTACT_FINDER_SYSTEM, prompt, api_key, max_tokens=1024)
        result = parse_json_safe(raw, {"contacts": [], "email_pattern": ""})

        contacts = []
        for item in result.get("contacts", []):
            name = item.get("name", "")
            if not name or len(name) < 2:
                continue
            contacts.append({
                "name": name,
                "title": item.get("title", "Hiring Team"),
                "linkedin_url": None,
                "email": item.get("email"),
                "source": "ai_analysis",
            })

        return contacts
    except Exception as e:
        logger.warning("Claude contact finder failed: %s", e)
        return []


async def _web_search_contacts(
    company_name: str,
    domain: str | None,
    job_title: str | None,
    use_sources: set[str],
) -> list[dict]:
    """Aggregate contacts from web search sources."""
    contacts = []
    if "web_search" in use_sources:
        contacts.extend(await _search_web(company_name, domain, job_title))
    if job_title:
        contacts.extend(await _search_job_poster(company_name, job_title))
    return contacts


async def _search_job_poster(company_name: str, job_title: str) -> list[dict]:
    """Search for the recruiter/hiring manager who posted a specific job."""
    contacts = []
    queries = [
        f'"{company_name}" "{job_title}" recruiter OR "hiring manager" OR "talent acquisition"',
        f'site:linkedin.com/in "{company_name}" "{job_title}" recruiter',
    ]

    for query in queries[:2]:
        try:
            results = await web_search(query, num=3)
            for item in results:
                href = item.get("link", "")
                if "linkedin.com/in/" in href:
                    contact = _parse_linkedin_result(
                        item.get("title", ""), href, item.get("snippet", ""),
                    )
                    if contact:
                        contact["source"] = "web_search"
                        contacts.append(contact)
        except Exception as e:
            logger.warning("Job poster search failed: %s", e)

    return contacts


async def _search_web(company_name: str, domain: str | None, job_title: str | None = None) -> list[dict]:
    """Search the broader web for contacts at a company."""
    contacts = []
    queries = [
        f'"{company_name}" hiring manager recruiter email',
    ]
    if job_title:
        queries.append(f'"{company_name}" "{job_title}" recruiter contact')
    if domain:
        queries.append(f'site:{domain} team leadership engineering')

    for query in queries[:2]:
        try:
            results = await web_search(query, num=5)
            for item in results:
                href = item.get("link", "")
                title_text = item.get("title", "")
                snippet_text = item.get("snippet", "")

                if "linkedin.com/in/" in href:
                    contact = _parse_linkedin_result(title_text, href, snippet_text)
                    if contact:
                        contact["source"] = "web_search"
                        contacts.append(contact)
                elif domain and domain in href:
                    page_contacts = _extract_people_from_snippet(snippet_text, href)
                    contacts.extend(page_contacts)
        except Exception as e:
            logger.warning("Web contact search failed: %s", e)

    return contacts


async def _scrape_team_page(company_name: str, domain: str) -> list[dict]:
    """Try to scrape contacts from a company's team/about page."""
    import httpx

    contacts = []
    team_paths = ["/team", "/about", "/about-us", "/company/team", "/people"]

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for path in team_paths:
            try:
                url = f"https://{domain}{path}"
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                })
                if resp.status_code != 200:
                    continue

                from bs4 import BeautifulSoup
                soup = BeautifulSoup(resp.text, "html.parser")

                # Look for people cards — common patterns
                for card in soup.select('[class*="team"], [class*="person"], [class*="member"], [class*="staff"]'):
                    name_el = card.select_one('h2, h3, h4, [class*="name"]')
                    title_el = card.select_one('p, span, [class*="title"], [class*="role"], [class*="position"]')
                    if name_el:
                        name = name_el.get_text(strip=True)
                        title = title_el.get_text(strip=True) if title_el else ""
                        if name and len(name) > 2 and len(name) < 80:
                            contacts.append({
                                "name": name,
                                "title": title or "Team Member",
                                "linkedin_url": None,
                                "email": None,
                                "source": "team_page",
                            })

                if contacts:
                    break  # Found team page, stop trying other paths
            except Exception:
                continue

    return contacts[:10]  # Cap at 10 to avoid noise


# ── Parsing Helpers ───────────────────────────────────────────

def _parse_linkedin_result(title: str, url: str, snippet: str) -> dict | None:
    """Extract name and title from a LinkedIn search result found via web search."""
    if "linkedin.com/in/" not in url:
        return None

    name = ""
    person_title = ""

    match = re.match(r"^(.+?)\s*[-–—|]\s*(.+?)(?:\s*[-–—|]\s*LinkedIn)?$", title)
    if match:
        name = match.group(1).strip()
        person_title = match.group(2).strip()
    elif title:
        name = title.replace(" - LinkedIn", "").replace(" | LinkedIn", "").strip()

    if not name or len(name) < 2:
        return None

    return {
        "name": name,
        "title": person_title,
        "linkedin_url": url.split("?")[0],
        "source": "web_search",
    }


def _extract_people_from_snippet(snippet: str, url: str) -> list[dict]:
    """Try to extract people's names from a team/about page snippet."""
    contacts = []
    patterns = re.findall(
        r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s*[-,–—]\s*((?:VP|Director|Head|Manager|CTO|CEO|Lead|Senior|Chief)[^,.;]*)",
        snippet,
    )
    for name, person_title in patterns:
        contacts.append({
            "name": name.strip(),
            "title": person_title.strip(),
            "linkedin_url": None,
            "source": "web_search",
        })
    return contacts


def infer_emails(first_name: str, last_name: str, domain: str) -> list[str]:
    """Generate candidate email addresses from name + domain."""
    first = first_name.lower().strip()
    last = last_name.lower().strip()

    if not first or not last or not domain:
        return []

    return [
        f"{first}.{last}@{domain}",
        f"{first}@{domain}",
        f"{first}{last}@{domain}",
        f"{first[0]}{last}@{domain}",
        f"{first}_{last}@{domain}",
        f"{first[0]}.{last}@{domain}",
    ]


async def verify_mx(domain: str) -> bool:
    """Check if domain has valid MX records."""
    try:
        answers = dns.resolver.resolve(domain, "MX")
        return len(answers) > 0
    except Exception:
        return False


def _dedupe_contacts(contacts: list[dict]) -> list[dict]:
    """Deduplicate contacts by LinkedIn URL or name."""
    seen_urls = set()
    seen_names = set()
    unique = []
    for c in contacts:
        url_key = c.get("linkedin_url", "")
        name_key = c.get("name", "").lower()
        if url_key and url_key in seen_urls:
            continue
        if not url_key and name_key in seen_names:
            continue
        if url_key:
            seen_urls.add(url_key)
        seen_names.add(name_key)
        unique.append(c)
    return unique
