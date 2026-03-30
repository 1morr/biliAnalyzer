import pytest
from unittest.mock import patch
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

# Import all models so they register with Base.metadata before init_db runs
import app.models  # noqa: F401 — side-effect import registers all tables
from app.core.database import Base


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
async def setup_db():
    """Create all tables in an in-memory SQLite database for each test."""
    test_engine = create_async_engine(TEST_DB_URL, echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


async def test_all_tables_created(setup_db):
    test_engine = setup_db
    async with test_engine.connect() as conn:
        table_names = await conn.run_sync(lambda c: inspect(c).get_table_names())
    expected = {"users", "videos", "video_stats", "video_content", "queries", "query_videos", "app_settings"}
    assert expected.issubset(set(table_names))
