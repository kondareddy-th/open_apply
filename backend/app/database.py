from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# SQLite needs special handling for async
_engine_kwargs = {
    "echo": False,
}

if settings.is_sqlite:
    # SQLite: no pool, connect_args for thread safety
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["pool_pre_ping"] = True
else:
    # PostgreSQL: connection pooling
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 2

engine = create_async_engine(settings.database_url, **_engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session
