# backend/app/api/settings.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import AppSettings
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.core.security import encrypt_value, decrypt_value

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


@router.post("/settings/test-ai")
async def test_ai_connection(db: AsyncSession = Depends(get_db)):
    from openai import AsyncOpenAI
    row_url = await db.get(AppSettings, "ai_base_url")
    row_key = await db.get(AppSettings, "ai_api_key")
    row_model = await db.get(AppSettings, "ai_model")

    base_url = row_url.value if row_url else DEFAULTS["ai_base_url"]
    api_key = ""
    if row_key and row_key.value and row_key.is_sensitive:
        api_key = decrypt_value(row_key.value)
    elif row_key:
        api_key = row_key.value
    model = row_model.value if row_model else DEFAULTS["ai_model"]

    if not api_key:
        return {"status": "error", "message": "API key not configured"}

    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        resp = await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "Say OK"}], max_tokens=5
        )
        return {"status": "ok", "model": model}
    except Exception as e:
        return {"status": "error", "message": str(e)}
