# backend/tests/test_bilibili.py
import pytest
from app.services.bilibili import BilibiliClient


def test_get_mixin_key():
    """Test mixin key derivation from img_key + sub_key using known values."""
    client = BilibiliClient.__new__(BilibiliClient)
    # Use known test vectors from bilibili-API-collect
    img_key = "7cd084941338484aae1ad9425b84077c"
    sub_key = "4932caff0ff746eab6f01bf08b70ac45"
    mixin_key = client._get_mixin_key(img_key + sub_key)
    assert len(mixin_key) == 32
    assert isinstance(mixin_key, str)


def test_sign_params():
    client = BilibiliClient.__new__(BilibiliClient)
    client._img_key = "7cd084941338484aae1ad9425b84077c"
    client._sub_key = "4932caff0ff746eab6f01bf08b70ac45"
    params = {"mid": 546195}
    signed = client._sign_wbi(params)
    assert "w_rid" in signed
    assert "wts" in signed
    assert "mid" in signed


@pytest.mark.asyncio
async def test_get_danmakus_returns_empty_without_sessdata():
    client = BilibiliClient.__new__(BilibiliClient)
    client._sessdata = None

    result = await client.get_danmakus(123)

    assert result == []


@pytest.mark.asyncio
async def test_get_subtitle_returns_empty_without_sessdata():
    client = BilibiliClient.__new__(BilibiliClient)
    client._sessdata = None

    result = await client.get_subtitle("BV1xx411c7mD", 1, 2)

    assert result == ""


@pytest.mark.asyncio
async def test_validate_sessdata_returns_user_name():
    client = BilibiliClient.__new__(BilibiliClient)
    client._sessdata = "test-sessdata"

    async def fake_request(url: str, params: dict | None = None, wbi: bool = False):
        return {"code": 0, "data": {"isLogin": True, "uname": "Roxy"}}

    client._request = fake_request

    result = await client.validate_sessdata()

    assert result == {"uname": "Roxy"}


@pytest.mark.asyncio
async def test_validate_sessdata_raises_for_invalid_cookie():
    client = BilibiliClient.__new__(BilibiliClient)
    client._sessdata = "expired-sessdata"

    async def fake_request(url: str, params: dict | None = None, wbi: bool = False):
        return {"code": 0, "data": {"isLogin": False}}

    client._request = fake_request

    with pytest.raises(Exception, match="invalid or expired"):
        await client.validate_sessdata()


@pytest.mark.asyncio
async def test_aclose_ignores_missing_client():
    client = BilibiliClient.__new__(BilibiliClient)

    await client.aclose()


def test_normalize_video_stub_prefers_pubdate_and_strips_highlight():
    client = BilibiliClient.__new__(BilibiliClient)

    video = client._normalize_video_stub(
        {
            "bvid": "BV1test",
            "title": '<em class="keyword">Hello</em>',
            "pubdate": 200,
            "ctime": 100,
        },
        "rec_archives_full",
    )

    assert video == {
        "bvid": "BV1test",
        "title": "Hello",
        "published_ts": 200,
        "created": 200,
        "source": "rec_archives_full",
        "ctime": 100,
    }


def test_is_live_replay_video_matches_auto_uploaded_pattern_only():
    client = BilibiliClient.__new__(BilibiliClient)

    assert client._is_live_replay_video("【直播回放】超短电影回(已报备) 2026年03月29日20点场", []) is True
    assert client._is_live_replay_video("普通视频", ["【直播回放】舰礼等身抱枕套最后一天！嗷！ 2026年03月30日20点场"]) is True
    assert client._is_live_replay_video("【直播回放】我自己剪辑的总结视频", []) is False
    assert client._is_live_replay_video("普通视频", ["直播回放 2026-03-29"]) is False
    assert client._is_live_replay_video("普通视频", ["第一P", "第二P"]) is False


@pytest.mark.asyncio
async def test_video_index_via_rec_archives_full_prefers_pn0_and_normalizes():
    client = BilibiliClient.__new__(BilibiliClient)
    calls = []

    async def fake_request(url: str, params: dict | None = None, wbi: bool = False):
        calls.append({"url": url, "params": params, "wbi": wbi})
        return {
            "code": 0,
            "data": {
                "archives": [
                    {
                        "bvid": "BV1",
                        "title": '<em class="keyword">First</em>',
                        "pubdate": 200,
                        "ctime": 150,
                    },
                    {
                        "bvid": "BV2",
                        "title": "Second",
                        "ctime": 100,
                    },
                ],
                "page": {"num": 0, "size": 20, "total": 2},
            },
        }

    client._request = fake_request

    result = await client._video_index_via_rec_archives_full(546195)

    assert calls == [{
        "url": "https://api.bilibili.com/x/series/recArchivesByKeywords",
        "params": {"mid": 546195, "keywords": "", "orderby": "senddate", "pn": 0},
        "wbi": False,
    }]
    assert result["is_complete_snapshot"] is True
    assert result["videos"] == [
        {
            "bvid": "BV1",
            "title": "First",
            "published_ts": 200,
            "created": 200,
            "source": "rec_archives_full",
            "ctime": 150,
        },
        {
            "bvid": "BV2",
            "title": "Second",
            "published_ts": 100,
            "created": 100,
            "source": "rec_archives_full",
            "ctime": 100,
        },
    ]


@pytest.mark.asyncio
async def test_get_video_index_falls_back_to_paged_rec_archives():
    client = BilibiliClient.__new__(BilibiliClient)

    async def fake_total(uid: int):
        assert uid == 546195
        return 2

    async def fail_full(uid: int, expected_total: int | None = None):
        assert expected_total == 2
        raise Exception("412")

    async def ok_paged(uid: int, expected_total: int | None = None):
        assert uid == 546195
        assert expected_total == 2
        return {
            "videos": [
                {"bvid": "BV2", "title": "Second", "published_ts": 100, "created": 100, "source": "rec_archives_paged"},
                {"bvid": "BV1", "title": "First", "published_ts": 200, "created": 200, "source": "rec_archives_paged"},
            ],
            "total": 2,
            "is_complete_snapshot": True,
        }

    async def should_not_run(uid: int, expected_total: int | None = None):
        raise AssertionError("unexpected fallback")

    client._get_expected_video_total = fake_total
    client._video_index_via_rec_archives_full = fail_full
    client._video_index_via_rec_archives_pages = ok_paged
    client._video_index_via_arc_search = should_not_run
    client._video_index_via_search = should_not_run

    result = await client.get_video_index(546195)

    assert result == {
        "videos": [
            {"bvid": "BV1", "title": "First", "published_ts": 200, "created": 200, "source": "rec_archives_paged"},
            {"bvid": "BV2", "title": "Second", "published_ts": 100, "created": 100, "source": "rec_archives_paged"},
        ],
        "total": 2,
        "expected_total": 2,
        "source": "rec_archives_paged",
        "is_complete_snapshot": True,
    }


@pytest.mark.asyncio
async def test_get_video_index_tries_next_fallback_when_partial():
    client = BilibiliClient.__new__(BilibiliClient)

    async def fake_total(uid: int):
        return 3

    async def partial_paged(uid: int, expected_total: int | None = None):
        return {
            "videos": [
                {"bvid": "BV2", "title": "Second", "published_ts": 100, "created": 100, "source": "rec_archives_paged"},
                {"bvid": "BV1", "title": "First", "published_ts": 200, "created": 200, "source": "rec_archives_paged"},
            ],
            "total": 3,
            "is_complete_snapshot": False,
        }

    async def complete_arc(uid: int, expected_total: int | None = None):
        return {
            "videos": [
                {"bvid": "BV3", "title": "Third", "published_ts": 300, "created": 300, "source": "arc_search"},
                {"bvid": "BV2", "title": "Second", "published_ts": 100, "created": 100, "source": "arc_search"},
                {"bvid": "BV1", "title": "First", "published_ts": 200, "created": 200, "source": "arc_search"},
            ],
            "total": 3,
            "is_complete_snapshot": False,
        }

    async def fail_full(uid: int, expected_total: int | None = None):
        raise Exception("412")

    async def should_not_run(uid: int, expected_total: int | None = None):
        raise AssertionError("unexpected fallback")

    client._get_expected_video_total = fake_total
    client._video_index_via_rec_archives_full = fail_full
    client._video_index_via_rec_archives_pages = partial_paged
    client._video_index_via_arc_search = complete_arc
    client._video_index_via_search = should_not_run

    result = await client.get_video_index(546195)

    assert result == {
        "videos": [
            {"bvid": "BV3", "title": "Third", "published_ts": 300, "created": 300, "source": "arc_search"},
            {"bvid": "BV1", "title": "First", "published_ts": 200, "created": 200, "source": "arc_search"},
            {"bvid": "BV2", "title": "Second", "published_ts": 100, "created": 100, "source": "arc_search"},
        ],
        "total": 3,
        "expected_total": 3,
        "source": "arc_search",
        "is_complete_snapshot": True,
    }


def test_filter_live_replay_stubs_removes_auto_uploaded_replays():
    client = BilibiliClient.__new__(BilibiliClient)

    videos = client._filter_live_replay_stubs([
        {"bvid": "BV1", "title": "【直播回放】超短电影回(已报备) 2026年03月29日20点场"},
        {"bvid": "BV2", "title": "普通投稿"},
    ])

    assert videos == [{"bvid": "BV2", "title": "普通投稿"}]


@pytest.mark.asyncio
async def test_get_video_index_keeps_best_partial_result_on_last_fallback():
    client = BilibiliClient.__new__(BilibiliClient)

    async def fake_total(uid: int):
        return 4

    async def fail_full(uid: int, expected_total: int | None = None):
        raise Exception("412")

    async def partial_paged(uid: int, expected_total: int | None = None):
        return {
            "videos": [
                {"bvid": "BV4", "title": "Fourth", "published_ts": 400, "created": 400, "source": "rec_archives_paged"},
                {"bvid": "BV3", "title": "Third", "published_ts": 300, "created": 300, "source": "rec_archives_paged"},
                {"bvid": "BV2", "title": "Second", "published_ts": 200, "created": 200, "source": "rec_archives_paged"},
            ],
            "total": 4,
            "is_complete_snapshot": False,
        }

    async def smaller_arc(uid: int, expected_total: int | None = None):
        return {
            "videos": [
                {"bvid": "BV2", "title": "Second", "published_ts": 200, "created": 200, "source": "arc_search"},
                {"bvid": "BV1", "title": "First", "published_ts": 100, "created": 100, "source": "arc_search"},
            ],
            "total": 4,
            "is_complete_snapshot": False,
        }

    async def smallest_search(uid: int, expected_total: int | None = None):
        return {
            "videos": [
                {"bvid": "BV1", "title": "First", "published_ts": 100, "created": 100, "source": "search"},
            ],
            "total": 4,
            "is_complete_snapshot": False,
        }

    client._get_expected_video_total = fake_total
    client._video_index_via_rec_archives_full = fail_full
    client._video_index_via_rec_archives_pages = partial_paged
    client._video_index_via_arc_search = smaller_arc
    client._video_index_via_search = smallest_search

    result = await client.get_video_index(546195)

    assert result == {
        "videos": [
            {"bvid": "BV4", "title": "Fourth", "published_ts": 400, "created": 400, "source": "rec_archives_paged"},
            {"bvid": "BV3", "title": "Third", "published_ts": 300, "created": 300, "source": "rec_archives_paged"},
            {"bvid": "BV2", "title": "Second", "published_ts": 200, "created": 200, "source": "rec_archives_paged"},
        ],
        "total": 3,
        "expected_total": 4,
        "source": "rec_archives_paged",
        "is_complete_snapshot": False,
    }


@pytest.mark.asyncio
async def test_get_video_detail_marks_live_replay():
    client = BilibiliClient.__new__(BilibiliClient)
    client.BASE = BilibiliClient.BASE

    async def fake_request(url: str, params: dict | None = None, wbi: bool = False):
        if url.endswith("/x/web-interface/view"):
            return {
                "code": 0,
                "data": {
                    "bvid": "BV1",
                    "aid": 1,
                    "cid": 2,
                    "title": "【直播回放】超短电影回(已报备) 2026年03月29日20点场",
                    "desc": "",
                    "pic": "http://example.com/cover.jpg",
                    "duration": 100,
                    "pubdate": 123,
                    "stat": {
                        "view": 1,
                        "like": 2,
                        "coin": 3,
                        "favorite": 4,
                        "share": 5,
                        "danmaku": 6,
                        "reply": 7,
                    },
                    "pages": [
                        {"page": 1, "cid": 2, "part": "【直播回放】超短电影回(已报备) 2026年03月29日20点场"}
                    ],
                    "subtitle": {"list": []},
                },
            }
        if url.endswith("/x/tag/archive/tags"):
            return {"code": 0, "data": []}
        raise AssertionError(f"unexpected url: {url}")

    client._request = fake_request

    result = await client.get_video_detail("BV1")

    assert result["is_live_replay"] is True


@pytest.mark.asyncio
async def test_get_video_list_slices_video_index_result():
    client = BilibiliClient.__new__(BilibiliClient)

    async def fake_index(uid: int):
        assert uid == 546195
        return {
            "videos": [
                {"bvid": "BV1", "published_ts": 300, "created": 300},
                {"bvid": "BV2", "published_ts": 200, "created": 200},
                {"bvid": "BV3", "published_ts": 100, "created": 100},
            ]
        }

    client.get_video_index = fake_index

    result = await client.get_video_list(546195, page=2, page_size=2)

    assert result == {
        "videos": [{"bvid": "BV3", "published_ts": 100, "created": 100}],
        "total": 3,
        "page": 2,
    }
