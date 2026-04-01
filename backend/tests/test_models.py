import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Import all models so they register with Base.metadata before init_db runs
import app.models  # noqa: F401 — side-effect import registers all tables
from app.core.database import Base
from app.models import User, Video, VideoContent
from app.services.fetch_task import _upsert_video_content
from app.services.wordcloud_svc import compute_location_frequencies, extract_location_comments


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
        indexes = (await conn.execute(text("PRAGMA index_list('video_content')"))).all()
    expected = {"users", "videos", "video_stats", "video_content", "queries", "query_videos", "app_settings"}
    assert expected.issubset(set(table_names))
    assert any(index[1] == 'sqlite_autoindex_video_content_1' or index[1] == 'ux_video_content_bvid' for index in indexes)


async def test_upsert_video_content_updates_existing_row(setup_db):
    test_engine = setup_db
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async with session_factory() as session:
        session.add(User(uid=1, name="Roxy", avatar_url=None))
        session.add(Video(bvid="BV1", uid=1, title="Test video", duration=1))
        session.add(VideoContent(bvid="BV1", comments="[]", danmakus="[]", subtitle="old"))
        await session.commit()

        await _upsert_video_content(
            session,
            bvid="BV1",
            comments=[{"text": "fresh"}],
            danmakus=["弹幕"],
            subtitle="new subtitle",
        )
        await session.commit()

        rows = (await session.execute(select(VideoContent).where(VideoContent.bvid == "BV1"))).scalars().all()

    assert len(rows) == 1
    assert rows[0].comments == '[{"text": "fresh"}]'
    assert rows[0].danmakus == '["弹幕"]'
    assert rows[0].subtitle == "new subtitle"


async def test_init_db_creates_video_content_unique_index(setup_db):
    test_engine = setup_db

    async with test_engine.begin() as conn:
        indexes = (await conn.execute(text("PRAGMA index_list('video_content')"))).all()

    assert any(index[1] == 'sqlite_autoindex_video_content_1' or index[1] == 'ux_video_content_bvid' for index in indexes)


def test_compute_location_frequencies_counts_unique_users_per_region():
    items = [
        {"text": "1", "user": "alice", "location": "IP属地：北京"},
        {"text": "2", "user": "alice", "location": "北京"},
        {"text": "3", "user": "bob", "location": "北京"},
        {"text": "4", "user": "carol", "location": "IP属地：上海"},
        {"text": "5", "user": "", "location": "广州"},
        {"text": "6", "user": "dave", "location": ""},
    ]

    words = compute_location_frequencies(items)

    assert words == [
        {"name": "北京", "value": 2},
        {"name": "上海", "value": 1},
    ]


def test_compute_location_frequencies_counts_same_user_once_per_normalized_region():
    items = [
        {"text": "1", "user": "alice", "location": "IP属地：北京"},
        {"text": "2", "user": "alice", "location": "北京"},
        {"text": "3", "user": "alice", "location": "IP属地：北京"},
    ]

    words = compute_location_frequencies(items)

    assert words == [{"name": "北京", "value": 1}]


def test_extract_location_comments_counts_unique_users_and_normalizes_location():
    texts = [
        ("BV1", "Video 1", "first from alice", "alice", "comment", "IP属地：北京"),
        ("BV1", "Video 1", "second from alice", "alice", "comment", "北京"),
        ("BV1", "Video 1", "from bob", "bob", "comment", "北京"),
        ("BV2", "Video 2", "cross-video duplicate alice", "alice", "comment", "北京"),
        ("BV2", "Video 2", "from carol", "carol", "comment", "IP属地：上海"),
        ("BV2", "Video 2", "missing user", "", "comment", "北京"),
    ]

    videos = extract_location_comments(texts, "北京")

    assert videos == [
        {
            "bvid": "BV1",
            "title": "Video 1",
            "count": 2,
            "snippets": [
                {"text": "first from alice", "user": "alice", "source": "comment"},
                {"text": "from bob", "user": "bob", "source": "comment"},
            ],
        }
    ]
