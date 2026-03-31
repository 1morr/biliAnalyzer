# backend/app/api/settings.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import AppSettings
from app.schemas.settings import SettingsResponse, SettingsUpdate, SessdataTestRequest, AiTestRequest
from app.core.security import encrypt_value, decrypt_value
from app.services.bilibili import BilibiliClient

router = APIRouter()

SENSITIVE_KEYS = {"ai_api_key", "sessdata"}
MASK = "***"

DEFAULTS = {
    "sessdata": "",
    "ai_base_url": "https://api.openai.com/v1",
    "ai_api_key": "",
    "ai_model": "gpt-4o",
}


async def _get_setting(db: AsyncSession, key: str) -> str:
    row = await db.get(AppSettings, key)
    if not row:
        return DEFAULTS.get(key, "")
    if row.is_sensitive and row.value:
        return MASK
    return row.value


async def _set_setting(db: AsyncSession, key: str, value: str):
    if value == MASK:
        return  # Skip masked values
    is_sensitive = key in SENSITIVE_KEYS
    row = await db.get(AppSettings, key)
    if row:
        row.value = encrypt_value(value) if is_sensitive and value else value
        row.is_sensitive = is_sensitive
    else:
        db.add(AppSettings(
            key=key,
            value=encrypt_value(value) if is_sensitive and value else value,
            is_sensitive=is_sensitive,
        ))


async def _get_raw_setting(db: AsyncSession, key: str) -> str:
    row = await db.get(AppSettings, key)
    if not row or not row.value:
        return DEFAULTS.get(key, "")
    if row.is_sensitive:
        return decrypt_value(row.value)
    return row.value


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    return SettingsResponse(
        sessdata=await _get_setting(db, "sessdata"),
        ai_base_url=await _get_setting(db, "ai_base_url"),
        ai_api_key=await _get_setting(db, "ai_api_key"),
        ai_model=await _get_setting(db, "ai_model"),
    )


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(data: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    if data.sessdata is not None:
        await _set_setting(db, "sessdata", data.sessdata)
    if data.ai_base_url is not None:
        await _set_setting(db, "ai_base_url", data.ai_base_url)
    if data.ai_api_key is not None:
        await _set_setting(db, "ai_api_key", data.ai_api_key)
    if data.ai_model is not None:
        await _set_setting(db, "ai_model", data.ai_model)
    await db.commit()
    return await get_settings(db)


@router.post("/settings/test-sessdata")
async def test_sessdata_connection(data: SessdataTestRequest, db: AsyncSession = Depends(get_db)):
    sessdata = data.sessdata
    if sessdata == MASK:
        sessdata = await _get_raw_setting(db, "sessdata")

    if sessdata is None:
        sessdata = await _get_raw_setting(db, "sessdata")

    if not sessdata:
        return {"status": "error", "message": "SESSDATA not configured"}

    client = BilibiliClient(sessdata=sessdata)
    try:
        result = await client.validate_sessdata()
        uname = result.get("uname")
        return {"status": "ok", "message": f"Connected as {uname}" if uname else "SESSDATA is valid"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        await client.aclose()


@router.post("/settings/test-ai")
async def test_ai_connection(data: AiTestRequest, db: AsyncSession = Depends(get_db)):
    from openai import AsyncOpenAI

    base_url = data.ai_base_url if data.ai_base_url is not None else await _get_raw_setting(db, "ai_base_url")
    api_key = data.ai_api_key
    model = data.ai_model if data.ai_model is not None else await _get_raw_setting(db, "ai_model")

    if api_key == MASK or api_key is None:
        api_key = await _get_raw_setting(db, "ai_api_key")

    if not api_key:
        return {"status": "error", "message": "API key not configured"}

    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "Say OK"}], max_tokens=5
        )
        return {"status": "ok", "model": model}
    except Exception as e:
        return {"status": "error", "message": str(e)}
