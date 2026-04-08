import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db import UserProfile
from app.models.schemas import UserProfileCreate, UserProfileOut

router = APIRouter(prefix="/api", tags=["user_profile"])


@router.get("/profile", response_model=UserProfileOut | None)
async def get_profile(db: AsyncSession = Depends(get_db)):
    """Get the user profile (singleton — only one profile per instance)."""
    result = await db.execute(select(UserProfile).limit(1))
    profile = result.scalar_one_or_none()
    return profile


@router.put("/profile", response_model=UserProfileOut)
async def upsert_profile(data: UserProfileCreate, db: AsyncSession = Depends(get_db)):
    """Create or update the user profile."""
    existing = (await db.execute(select(UserProfile).limit(1))).scalar_one_or_none()

    if existing:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return existing

    profile = UserProfile(id=uuid.uuid4(), **data.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile
