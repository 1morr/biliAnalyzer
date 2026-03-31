from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass


async def _ensure_video_content_uniqueness(conn: AsyncSession):
    tables = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='video_content'"))
    if tables.first() is None:
        return
    indexes = await conn.execute(text("PRAGMA index_list('video_content')"))
    if any(row[2] for row in indexes.fetchall()):
        return
    await conn.execute(text("""
        DELETE FROM video_content
        WHERE id IN (
            SELECT older.id
            FROM video_content AS older
            JOIN video_content AS newer
              ON older.bvid = newer.bvid
             AND (
                 COALESCE(older.fetched_at, '') < COALESCE(newer.fetched_at, '')
                 OR (
                     COALESCE(older.fetched_at, '') = COALESCE(newer.fetched_at, '')
                     AND older.id < newer.id
                 )
             )
        )
    """))
    await conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_video_content_bvid ON video_content (bvid)"
    ))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_video_content_uniqueness(conn)
