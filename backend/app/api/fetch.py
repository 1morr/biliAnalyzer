import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, AppSettings
from app.schemas.query import FetchRequest, FetchResponse
from app.services.fetch_task import run_fetch
from app.core.security import decrypt_value

router = APIRouter()


@router.post("/fetch", response_model=FetchResponse)
async def create_fetch(req: FetchRequest, db: AsyncSession = Depends(get_db)):
    query = Query(uid=req.uid, start_date=req.start_date, end_date=req.end_date, status="pending")
    db.add(query)
    await db.commit()
    await db.refresh(query)

    # Get SESSDATA if configured
    sessdata_row = await db.get(AppSettings, "sessdata")
    sessdata = None
    if sessdata_row and sessdata_row.value:
        try:
            sessdata = decrypt_value(sessdata_row.value) if sessdata_row.is_sensitive else sessdata_row.value
        except Exception:
            pass

    asyncio.create_task(run_fetch(query.id, req.uid, req.start_date, req.end_date, sessdata))
    return FetchResponse(query_id=query.id, status="pending")
