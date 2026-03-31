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
