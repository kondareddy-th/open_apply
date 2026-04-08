import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    health, jobs, contacts, emails, pipeline, auth,
    interview_prep, notes, concepts, resume, applications, user_profile,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Nexus API starting")

    # Auto-create new tables if they don't exist
    try:
        from app.database import engine
        from app.models.db import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created")
    except Exception as e:
        logger.warning(f"Table creation check failed: {e} — tables may already exist")

    try:
        from app.services.scheduler import start_scheduler, stop_scheduler
        start_scheduler()
        logger.info("Scheduler started")
    except Exception:
        logger.warning("Scheduler failed to start — continuing without it")

    yield

    try:
        from app.services.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title="Nexus API",
    version=settings.app_version,
    description="AI Career Automation Platform — Job Pipeline",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(pipeline.router)
app.include_router(jobs.router)
app.include_router(contacts.router)
app.include_router(emails.router)
app.include_router(auth.router)
app.include_router(interview_prep.router)
app.include_router(notes.router)
app.include_router(concepts.router)
app.include_router(resume.router)
app.include_router(applications.router)
app.include_router(user_profile.router)
