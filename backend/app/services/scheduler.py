import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _scrape_job():
    """Scheduled task: scrape all active companies across all configured ATS boards."""
    from app.database import async_session
    from app.services.scraper import scrape_all_companies

    async with async_session() as db:
        try:
            results = await scrape_all_companies(db)
            total_new = sum(r["new_jobs"] for r in results)
            logger.info("Scheduled scrape complete: %d new jobs from %d sources", total_new, len(results))
        except Exception as e:
            logger.error("Scheduled scrape failed: %s", e)


async def _check_replies_job():
    """Scheduled task: check for email replies."""
    from app.database import async_session
    from app.models.db import Email
    from app.services.gmail import check_replies
    from sqlalchemy import select

    async with async_session() as db:
        try:
            sent_emails = (await db.execute(
                select(Email).where(
                    Email.status == "sent",
                    Email.gmail_thread_id.isnot(None),
                    Email.replied_at.is_(None),
                )
            )).scalars().all()

            thread_ids = [e.gmail_thread_id for e in sent_emails if e.gmail_thread_id]
            if not thread_ids:
                return

            replies = await check_replies(thread_ids, db)
            for reply in replies:
                for email in sent_emails:
                    if email.gmail_thread_id == reply["thread_id"]:
                        from datetime import datetime
                        email.replied_at = datetime.utcnow()
                        email.status = "replied"

            await db.commit()
            if replies:
                logger.info("Found %d new replies", len(replies))
        except Exception as e:
            logger.error("Reply check failed: %s", e)


async def _check_expired_job():
    """Scheduled task: mark stale jobs as expired."""
    from app.database import async_session
    from app.services.scraper import check_expired_jobs

    async with async_session() as db:
        try:
            result = await check_expired_jobs(db)
            if result["expired_count"]:
                logger.info("Marked %d jobs as expired", result["expired_count"])
        except Exception as e:
            logger.error("Expired job check failed: %s", e)


def start_scheduler():
    scheduler.add_job(_scrape_job, "interval", hours=6, id="scrape_all", replace_existing=True)
    scheduler.add_job(_check_replies_job, "interval", minutes=30, id="check_replies", replace_existing=True)
    scheduler.add_job(_check_expired_job, "interval", hours=12, id="check_expired", replace_existing=True)
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown(wait=False)
