"""Multi-board job scraper supporting Greenhouse, Lever, Ashby, Workable,
SmartRecruiters, Jobvite, and generic careers pages.

Inspired by career-ops portal scanner strategy:
  1. ATS APIs (Greenhouse, Lever) — structured JSON, fast, reliable
  2. ATS web pages (Ashby, Workable) — HTML scraping with BeautifulSoup
  3. Generic careers pages — HTML scraping as fallback

No LinkedIn dependency. All sources are public ATS APIs or career pages.
"""

import asyncio
import hashlib
import logging
import re
import uuid
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Company, Job

logger = logging.getLogger(__name__)

# All supported ATS sources
ALL_SOURCES = {"greenhouse", "lever", "ashby", "workable", "smartrecruiters", "jobvite", "custom"}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

_HTTP_TIMEOUT = 30


# ── Greenhouse ────────────────────────────────────────────────

async def scrape_greenhouse(slug: str, company_id, db: AsyncSession) -> dict:
    """Scrape jobs from Greenhouse public JSON API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    jobs_found = 0
    new_jobs = 0

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        for item in data.get("jobs", []):
            jobs_found += 1
            external_id = str(item["id"])

            existing = (await db.execute(
                select(Job).where(Job.source == "greenhouse", Job.external_id == external_id)
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            location_name = item.get("location", {}).get("name") if isinstance(item.get("location"), dict) else None
            departments = item.get("departments", [])
            department = departments[0].get("name") if departments else None

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=external_id,
                source="greenhouse",
                title=item.get("title", ""),
                department=department,
                location=location_name,
                url=item.get("absolute_url"),
                posted_at=_parse_date(item.get("updated_at")),
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("Greenhouse scrape failed for %s: %s", slug, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── Lever ─────────────────────────────────────────────────────

async def scrape_lever(slug: str, company_id, db: AsyncSession) -> dict:
    """Scrape jobs from Lever public JSON API."""
    url = f"https://api.lever.co/v0/postings/{slug}"
    jobs_found = 0
    new_jobs = 0

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        for item in data:
            jobs_found += 1
            external_id = item["id"]
            categories = item.get("categories", {})

            existing = (await db.execute(
                select(Job).where(Job.source == "lever", Job.external_id == external_id)
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=external_id,
                source="lever",
                title=item.get("text", ""),
                department=categories.get("department"),
                location=categories.get("location"),
                url=item.get("hostedUrl"),
                posted_at=_parse_timestamp(item.get("createdAt")),
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("Lever scrape failed for %s: %s", slug, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── Ashby ─────────────────────────────────────────────────────

async def scrape_ashby(slug: str, company_id, db: AsyncSession) -> dict:
    """Scrape jobs from Ashby posting API.

    API: GET https://api.ashbyhq.com/posting-api/job-board/{slug}
    Returns clean JSON with all listed jobs.
    """
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    jobs_found = 0
    new_jobs = 0

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            data = resp.json()

        for item in data.get("jobs", []):
            jobs_found += 1
            external_id = item.get("id", "")
            if not external_id:
                continue

            existing = (await db.execute(
                select(Job).where(Job.source == "ashby", Job.external_id == external_id)
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            # Location
            location = item.get("location") or item.get("locationName")
            if isinstance(location, dict):
                location = location.get("name")

            # Department
            department = item.get("department") or item.get("team")

            # URL
            job_url = item.get("jobUrl") or f"https://jobs.ashbyhq.com/{slug}/{external_id}"

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=external_id,
                source="ashby",
                title=item.get("title", ""),
                department=department,
                location=location,
                url=job_url,
                posted_at=_parse_date(item.get("publishedAt")),
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("Ashby scrape failed for %s: %s", slug, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── Workable ──────────────────────────────────────────────────

async def scrape_workable(slug: str, company_id, db: AsyncSession) -> dict:
    """Scrape jobs from Workable public API.

    Workable exposes: https://apply.workable.com/api/v3/accounts/{slug}/jobs
    """
    url = f"https://apply.workable.com/api/v3/accounts/{slug}/jobs"
    jobs_found = 0
    new_jobs = 0

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            # Workable uses a POST endpoint with pagination
            payload = {"query": "", "location": [], "department": [], "worktype": [], "remote": []}
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json", **_HEADERS})
            resp.raise_for_status()
            data = resp.json()

        for item in data.get("results", []):
            jobs_found += 1
            external_id = item.get("shortcode", item.get("id", ""))
            if not external_id:
                continue

            existing = (await db.execute(
                select(Job).where(Job.source == "workable", Job.external_id == str(external_id))
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            location_parts = []
            if item.get("city"):
                location_parts.append(item["city"])
            if item.get("state"):
                location_parts.append(item["state"])
            if item.get("country"):
                location_parts.append(item["country"])
            if item.get("telecommuting"):
                location_parts.insert(0, "Remote")
            location = ", ".join(location_parts) if location_parts else None

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=str(external_id),
                source="workable",
                title=item.get("title", ""),
                department=item.get("department"),
                location=location,
                url=f"https://apply.workable.com/{slug}/j/{external_id}/",
                posted_at=_parse_date(item.get("published_on")),
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("Workable scrape failed for %s: %s", slug, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── SmartRecruiters ───────────────────────────────────────────

async def scrape_smartrecruiters(company_id_or_slug: str, company_id, db: AsyncSession) -> dict:
    """Scrape jobs from SmartRecruiters public API.

    API: https://api.smartrecruiters.com/v1/companies/{id}/postings
    """
    url = f"https://api.smartrecruiters.com/v1/companies/{company_id_or_slug}/postings"
    jobs_found = 0
    new_jobs = 0

    try:
        all_items = []
        offset = 0
        limit = 100

        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            while True:
                resp = await client.get(url, params={"offset": offset, "limit": limit})
                resp.raise_for_status()
                data = resp.json()
                items = data.get("content", [])
                all_items.extend(items)
                if len(items) < limit:
                    break
                offset += limit

        for item in all_items:
            jobs_found += 1
            external_id = str(item.get("id", ""))
            if not external_id:
                continue

            existing = (await db.execute(
                select(Job).where(Job.source == "smartrecruiters", Job.external_id == external_id)
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            loc = item.get("location", {})
            location_parts = []
            if loc.get("city"):
                location_parts.append(loc["city"])
            if loc.get("region"):
                location_parts.append(loc["region"])
            if loc.get("country"):
                location_parts.append(loc["country"])
            if loc.get("remote"):
                location_parts.insert(0, "Remote")
            location = ", ".join(location_parts) if location_parts else None

            job_url = item.get("ref") or item.get("applyUrl")

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=external_id,
                source="smartrecruiters",
                title=item.get("name", ""),
                department=item.get("department", {}).get("label") if isinstance(item.get("department"), dict) else None,
                location=location,
                url=job_url,
                posted_at=_parse_date(item.get("releasedDate")),
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("SmartRecruiters scrape failed for %s: %s", company_id_or_slug, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── Jobvite ───────────────────────────────────────────────────

async def scrape_jobvite(slug: str, company_id, db: AsyncSession) -> dict:
    """Scrape jobs from Jobvite career page (HTML scraping).

    URL pattern: https://jobs.jobvite.com/{slug}/jobs
    """
    url = f"https://jobs.jobvite.com/{slug}/jobs"
    jobs_found = 0
    new_jobs = 0

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Jobvite uses .jv-job-list or table-based layouts
        job_links = soup.select('a.jv-job-link, a[href*="/job/"], table.jv-job-list a')

        for link in job_links:
            title = link.get_text(strip=True)
            href = link.get("href", "")
            if not title or not href:
                continue

            jobs_found += 1
            if not href.startswith("http"):
                href = f"https://jobs.jobvite.com{href}"

            external_id = _extract_jobvite_id(href) or _hash_external_id(href)

            existing = (await db.execute(
                select(Job).where(Job.source == "jobvite", Job.external_id == external_id)
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            # Try to get location from sibling elements
            parent = link.parent
            location = None
            if parent:
                loc_el = parent.select_one('.jv-job-list-location, .location')
                if loc_el:
                    location = loc_el.get_text(strip=True)

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=external_id,
                source="jobvite",
                title=title,
                location=location,
                url=href,
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("Jobvite scrape failed for %s: %s", slug, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── Generic Careers Page ──────────────────────────────────────

async def scrape_careers_page(careers_url: str, company_id, company_name: str, db: AsyncSession) -> dict:
    """Scrape jobs from a generic careers page by extracting job-like links.

    This is a best-effort scraper for companies that don't use a standard ATS.
    It looks for links that look like job postings based on URL patterns and text.
    """
    jobs_found = 0
    new_jobs = 0

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(careers_url, headers=_HEADERS)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Find all links that look like job postings
        job_patterns = re.compile(
            r'/jobs?/|/careers?/|/positions?/|/openings?/|/vacancies?/|/opportunities?/',
            re.IGNORECASE,
        )

        seen_urls = set()
        for link in soup.find_all("a", href=True):
            href = link["href"]
            title = link.get_text(strip=True)

            # Skip navigation links, anchors, etc.
            if not title or len(title) < 5 or len(title) > 200:
                continue
            if href.startswith("#") or href.startswith("mailto:") or href.startswith("javascript:"):
                continue

            # Must match a job-like URL pattern OR be inside a job listing container
            if not job_patterns.search(href):
                continue

            # Normalize URL
            if not href.startswith("http"):
                from urllib.parse import urljoin
                href = urljoin(careers_url, href)

            if href in seen_urls:
                continue
            seen_urls.add(href)

            # Skip if it's just the main careers page itself
            if href.rstrip("/") == careers_url.rstrip("/"):
                continue

            jobs_found += 1
            external_id = _hash_external_id(href)

            existing = (await db.execute(
                select(Job).where(Job.source == "custom", Job.external_id == external_id)
            )).scalar_one_or_none()

            if existing:
                existing.scraped_at = datetime.utcnow()
                continue

            job = Job(
                id=uuid.uuid4(),
                company_id=company_id,
                external_id=external_id,
                source="custom",
                title=title,
                url=href,
                scraped_at=datetime.utcnow(),
            )
            db.add(job)
            new_jobs += 1

        await db.commit()
    except Exception as e:
        logger.error("Careers page scrape failed for %s (%s): %s", company_name, careers_url, e)
        await db.rollback()

    return {"jobs_found": jobs_found, "new_jobs": new_jobs}


# ── Job Description Fetcher ───────────────────────────────────

async def fetch_job_description(job_id, db: AsyncSession) -> str | None:
    """Fetch full job description from source if not already stored."""
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        return None

    if job.description:
        return job.description

    try:
        if job.source == "greenhouse":
            row = (await db.execute(
                select(Company.greenhouse_slug).where(Company.id == job.company_id)
            )).scalar_one()
            url = f"https://boards-api.greenhouse.io/v1/boards/{row}/jobs/{job.external_id}"
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            description = data.get("content", "")

        elif job.source == "lever":
            # Lever job detail is in the listing itself, but we can try fetching HTML
            if job.url:
                async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=_HEADERS) as client:
                    resp = await client.get(job.url)
                soup = BeautifulSoup(resp.text, "html.parser")
                desc_el = soup.select_one('.section-wrapper.page-full-width, [class*="description"], .posting-requirements')
                description = desc_el.get_text(separator="\n", strip=True) if desc_el else ""
            else:
                return None

        elif job.source == "ashby" and job.url:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=_HEADERS) as client:
                resp = await client.get(job.url)
            soup = BeautifulSoup(resp.text, "html.parser")
            desc_el = soup.select_one('[class*="description"], [class*="content"], main')
            description = desc_el.get_text(separator="\n", strip=True) if desc_el else ""

        elif job.source == "workable" and job.url:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=_HEADERS) as client:
                resp = await client.get(job.url)
            soup = BeautifulSoup(resp.text, "html.parser")
            desc_el = soup.select_one('[data-ui="job-description"], [class*="description"]')
            description = desc_el.get_text(separator="\n", strip=True) if desc_el else ""

        elif job.url:
            # Generic fallback — try to extract from any job page
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=_HEADERS) as client:
                resp = await client.get(job.url)
            soup = BeautifulSoup(resp.text, "html.parser")
            desc_el = (
                soup.select_one('[class*="description"]')
                or soup.select_one('[class*="content"]')
                or soup.select_one('article')
                or soup.select_one('main')
            )
            description = desc_el.get_text(separator="\n", strip=True) if desc_el else ""
        else:
            return None

        if description:
            job.description = description
            await db.commit()
            return description
    except Exception as e:
        logger.warning("Failed to fetch description for job %s: %s", job_id, e)

    return None


# ── Expiry Checker ────────────────────────────────────────────

async def check_expired_jobs(db: AsyncSession) -> dict:
    """Check jobs that haven't been seen recently and mark as expired.

    Jobs not seen in the last 2 scrapes (scraped_at older than 7 days)
    are marked as expired.
    """
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(days=7)
    expired_count = 0

    result = await db.execute(
        select(Job).where(
            Job.status != "expired",
            Job.status != "applied",
            Job.status != "saved",
            Job.scraped_at < cutoff,
        )
    )
    stale_jobs = result.scalars().all()

    for job in stale_jobs:
        job.status = "expired"
        expired_count += 1

    if expired_count:
        await db.commit()

    return {"expired_count": expired_count}


# ── Orchestrator ──────────────────────────────────────────────

async def scrape_all_companies(
    db: AsyncSession,
    sources: set[str] | None = None,
) -> list[dict]:
    """Scrape jobs from all active companies using their configured ATS sources.

    Each company can have multiple ATS integrations (Greenhouse, Lever, Ashby, etc.).
    The scraper will try all configured sources for each company.
    """
    results = []
    rows = (await db.execute(
        select(
            Company.id, Company.name, Company.greenhouse_slug,
            Company.lever_slug, Company.ashby_slug, Company.workable_slug,
            Company.careers_url, Company.ats_type, Company.domain,
        )
        .where(Company.is_active == True)
    )).all()

    use_sources = sources or ALL_SOURCES

    for row in rows:
        cid, cname, gh_slug, lever_slug, ashby_slug, workable_slug, careers_url, ats_type, domain = row

        if "greenhouse" in use_sources and gh_slug:
            r = await scrape_greenhouse(gh_slug, cid, db)
            results.append({"company": cname, "source": "greenhouse", **r})

        if "lever" in use_sources and lever_slug:
            r = await scrape_lever(lever_slug, cid, db)
            results.append({"company": cname, "source": "lever", **r})

        if "ashby" in use_sources and ashby_slug:
            r = await scrape_ashby(ashby_slug, cid, db)
            results.append({"company": cname, "source": "ashby", **r})

        if "workable" in use_sources and workable_slug:
            r = await scrape_workable(workable_slug, cid, db)
            results.append({"company": cname, "source": "workable", **r})

        # SmartRecruiters uses the ats_type field
        if "smartrecruiters" in use_sources and ats_type == "smartrecruiters" and domain:
            sr_slug = domain.replace(".com", "").replace(".", "")
            r = await scrape_smartrecruiters(sr_slug, cid, db)
            results.append({"company": cname, "source": "smartrecruiters", **r})

        if "jobvite" in use_sources and ats_type == "jobvite" and domain:
            jv_slug = domain.replace(".com", "").replace(".", "")
            r = await scrape_jobvite(jv_slug, cid, db)
            results.append({"company": cname, "source": "jobvite", **r})

        # Custom / generic careers page as fallback
        if "custom" in use_sources and careers_url and ats_type in (None, "custom"):
            # Only scrape careers page if no other ATS slug is configured
            has_ats = gh_slug or lever_slug or ashby_slug or workable_slug
            if not has_ats:
                r = await scrape_careers_page(careers_url, cid, cname, db)
                results.append({"company": cname, "source": "custom", **r})

    return results


# ── Helpers ───────────────────────────────────────────────────

def _hash_external_id(value: str) -> str:
    """Generate a short hash for use as external_id."""
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def _extract_jobvite_id(url: str) -> str | None:
    """Extract Jobvite job ID from URL."""
    match = re.search(r"/job/([^/?]+)", url)
    return match.group(1) if match else None


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


def _parse_timestamp(ts: int | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(ts / 1000)
    except (ValueError, OSError):
        return None
