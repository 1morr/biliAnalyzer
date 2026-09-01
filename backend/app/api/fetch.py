import logging
from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.background_tasks import track_task
from app.core.deps import get_db
from app.models import AppSettings, Query
from app.schemas.query import FetchRequest, FetchResponse
from app.services.fetch_task import run_fetch
from app.core.security import decrypt_value

logger = logging.getLogger(__name__)

router = APIRouter()

DECRYPT_ERROR_MESSAGE = "Stored credential could not be decrypted — re-enter it in Settings"


def _decrypt_setting(row: AppSettings | None) -> str | None:
    """Decrypt a possibly-sensitive setting row. Raises HTTPException(400) if the
    stored value can't be decrypted (e.g. SECRET_KEY was rotated) instead of
    silently returning None, which would otherwise make a scrape run logged-out
    without any indication why."""
    if not row or not row.value:
        return None
    if not row.is_sensitive:
        return row.value
    try:
        return decrypt_value(row.value)
    except InvalidToken:
        logger.warning("Failed to decrypt setting %r; SECRET_KEY may have been rotated", row.key)
        raise HTTPException(status_code=400, detail=DECRYPT_ERROR_MESSAGE)


@router.post("/fetch", response_model=FetchResponse)
async def create_fetch(req: FetchRequest, db: AsyncSession = Depends(get_db)):
    # Get SESSDATA and proxy list before creating the query, so a decryption
    # failure doesn't leave a "pending" query behind that never starts.
    sessdata_row = await db.get(AppSettings, "sessdata")
    sessdata = _decrypt_setting(sessdata_row)

    proxy_list_row = await db.get(AppSettings, "proxy_list")
    proxy_list_value = _decrypt_setting(proxy_list_row)
    proxy_urls = [u.strip() for u in proxy_list_value.splitlines() if u.strip()] if proxy_list_value else []

    query = Query(uid=req.uid, start_date=req.start_date, end_date=req.end_date, status="pending")
    db.add(query)
    await db.commit()
    await db.refresh(query)

    track_task(run_fetch(query.id, req.uid, req.start_date, req.end_date, sessdata, proxy_urls=proxy_urls))
    return FetchResponse(query_id=query.id, status="pending")
