import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Import all models so they register with Base.metadata before init_db runs
import app.models  # noqa: F401 — side-effect import registers all tables
from app.core.database import Base
from app.models import User, Video, VideoContent
from app.services.fetch_task import _upsert_video_content
from app.services.wordcloud_svc import (
    compute_location_frequencies,
    compute_user_demographics,
    compute_user_frequencies,
    extract_location_comments,
    extract_user_comments,
)


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
        {"text": "1", "uid": 1, "user": "alice", "location": "IP属地：北京"},
        {"text": "2", "uid": 1, "user": "alice", "location": "北京"},
        {"text": "3", "uid": 2, "user": "bob", "location": "北京"},
        {"text": "4", "uid": 3, "user": "carol", "location": "IP属地：上海"},
        {"text": "5", "user": "", "location": "广州"},
        {"text": "6", "user": "dave", "location": ""},
    ]

    words = compute_location_frequencies(items)

    assert words == [
        {"name": "北京", "value": 2},
        {"name": "上海", "value": 1},
    ]


def test_compute_location_frequencies_counts_same_uid_once_per_normalized_region():
    items = [
        {"text": "1", "uid": 1, "user": "alice", "location": "IP属地：北京"},
        {"text": "2", "uid": 1, "user": "alice-renamed", "location": "北京"},
        {"text": "3", "uid": 1, "user": "alice", "location": "IP属地：北京"},
    ]

    words = compute_location_frequencies(items)

    assert words == [{"name": "北京", "value": 1}]


def test_extract_location_comments_counts_unique_users_and_normalizes_location():
    texts = [
        ("BV1", "Video 1", "first from alice", "alice", "comment", "IP属地：北京", 1),
        ("BV1", "Video 1", "second from alice", "alice", "comment", "北京", 1),
        ("BV1", "Video 1", "from bob", "bob", "comment", "北京", 2),
        ("BV2", "Video 2", "cross-video duplicate alice", "alice", "comment", "北京", 1),
        ("BV2", "Video 2", "from carol", "carol", "comment", "IP属地：上海", 3),
        ("BV2", "Video 2", "missing user", "", "comment", "北京", None),
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


def test_compute_location_frequencies_keeps_same_username_different_uids_separate():
    items = [
        {"text": "1", "uid": 1, "user": "alice", "location": "北京"},
        {"text": "2", "uid": 2, "user": "alice", "location": "北京"},
        {"text": "3", "user": "alice", "location": "北京"},
    ]

    words = compute_location_frequencies(items)

    assert words == [{"name": "北京", "value": 3}]


def test_compute_user_demographics_dedupes_by_uid_across_comments():
    items = [
        {"uid": 1, "user": "alice", "user_sex": "女", "user_level": 5, "vip_status": 1, "vip_type": 2},
        {"uid": 1, "user": "alice_renamed", "user_sex": "女", "user_level": 5, "vip_status": 1, "vip_type": 2},
        {"uid": 2, "user": "bob", "user_sex": "男", "user_level": 3, "vip_status": 0, "vip_type": 0},
    ]

    result = compute_user_demographics(items)

    assert result["total_unique_users"] == 2
    assert result["uid_backed_users"] == 2
    assert result["username_fallback_users"] == 0
    assert result["gender_ratio"] == [{"name": "男", "value": 1}, {"name": "女", "value": 1}]
    assert result["vip_ratio"] == [{"name": "非大会员", "value": 1}, {"name": "年度大会员", "value": 1}]


def test_compute_user_demographics_falls_back_to_username_for_historical_data():
    items = [
        {"user": "alice", "user_sex": "女", "user_level": 4, "vip_status": 1, "vip_type": 1},
        {"user": "alice", "user_sex": "女", "user_level": 4, "vip_status": 1, "vip_type": 1},
        {"user": "bob", "user_sex": "保密", "user_level": None, "vip_status": None, "vip_type": None},
    ]

    result = compute_user_demographics(items)

    assert result["total_unique_users"] == 2
    assert result["uid_backed_users"] == 0
    assert result["username_fallback_users"] == 2
    assert result["gender_ratio"] == [{"name": "女", "value": 1}, {"name": "保密", "value": 1}]
    assert result["level_distribution"] == [{"name": "LV4", "value": 1}, {"name": "未知", "value": 1}]
    assert result["vip_ratio"] == [{"name": "月度大会员", "value": 1}, {"name": "未知", "value": 1}]


def test_compute_user_demographics_promotes_username_fallback_to_uid():
    items = [
        {"user": "alice", "user_sex": "女", "user_level": 4, "vip_status": 1, "vip_type": 1},
        {"uid": 1, "user": "alice", "user_sex": "女", "user_level": 4, "vip_status": 1, "vip_type": 1},
    ]

    result = compute_user_demographics(items)

    assert result["total_unique_users"] == 1
    assert result["uid_backed_users"] == 1
    assert result["username_fallback_users"] == 0
    assert result["gender_ratio"] == [{"name": "女", "value": 1}]


def test_compute_user_demographics_keeps_username_fallback_separate_for_ambiguous_username():
    items = [
        {"uid": 1, "user": "alice", "user_sex": "女", "user_level": 4, "vip_status": 1, "vip_type": 1},
        {"uid": 2, "user": "alice", "user_sex": "男", "user_level": 2, "vip_status": 0, "vip_type": 0},
        {"user": "alice", "user_sex": "保密", "user_level": None, "vip_status": None, "vip_type": None},
    ]

    result = compute_user_demographics(items)

    assert result["total_unique_users"] == 3
    assert result["uid_backed_users"] == 2
    assert result["username_fallback_users"] == 1
    assert result["gender_ratio"] == [{"name": "男", "value": 1}, {"name": "女", "value": 1}, {"name": "保密", "value": 1}]


def test_compute_user_frequencies_groups_by_uid():
    """Same uid with different usernames should be grouped as one identity."""
    items = [
        {"uid": 1, "user": "alice", "text": "a"},
        {"uid": 1, "user": "alice_renamed", "text": "b"},
        {"uid": 2, "user": "bob", "text": "c"},
    ]

    words = compute_user_frequencies(items)

    # uid:1 has 2 comments (displayed as last-seen username "alice_renamed"), uid:2 has 1
    assert len(words) == 2
    assert words[0]["value"] == 2
    assert words[0]["name"] == "alice_renamed"
    assert words[1] == {"name": "bob", "value": 1}


def test_compute_user_frequencies_falls_back_to_username_without_uid():
    """Items without uid should fall back to username identity."""
    items = [
        {"user": "alice", "text": "a"},
        {"user": "alice", "text": "b"},
        {"user": "bob", "text": "c"},
    ]

    words = compute_user_frequencies(items)

    assert words == [
        {"name": "alice", "value": 2},
        {"name": "bob", "value": 1},
    ]


def test_compute_user_frequencies_skips_items_without_identity():
    """Items with no uid and no user should be skipped."""
    items = [
        {"uid": 1, "user": "alice", "text": "a"},
        {"user": "", "text": "b"},
        {"text": "c"},
    ]

    words = compute_user_frequencies(items)

    assert words == [{"name": "alice", "value": 1}]


def test_extract_user_comments_finds_all_comments_by_uid():
    """Clicking 'alice' should find all comments by uid:1, even with different usernames."""
    texts = [
        ("BV1", "Video 1", "first comment", "alice", "comment", None, 1),
        ("BV1", "Video 1", "second comment", "alice_old", "comment", None, 1),
        ("BV2", "Video 2", "from bob", "bob", "comment", None, 2),
    ]

    videos = extract_user_comments(texts, "alice")

    assert len(videos) == 1
    assert videos[0]["bvid"] == "BV1"
    assert videos[0]["count"] == 2
    assert len(videos[0]["snippets"]) == 2


def test_extract_user_comments_falls_back_to_username():
    """Without uid, should match by username only."""
    texts = [
        ("BV1", "Video 1", "hello", "alice", "comment", None, None),
        ("BV1", "Video 1", "world", "alice", "comment", None, None),
        ("BV1", "Video 1", "other", "bob", "comment", None, None),
    ]

    videos = extract_user_comments(texts, "alice")

    assert len(videos) == 1
    assert videos[0]["count"] == 2
