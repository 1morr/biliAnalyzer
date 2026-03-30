from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video
from app.schemas.query import QuerySummary, QueryDetail

router = APIRouter()


@router.get("/queries", response_model=list[QuerySummary])
async def list_queries(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Query).order_by(Query.created_at.desc()))
    return result.scalars().all()


@router.get("/queries/{query_id}", response_model=QueryDetail)
async def get_query(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    return query


@router.delete("/queries/{query_id}")
async def delete_query(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    # Get video bvids for this query
    qv_result = await db.execute(select(QueryVideo.bvid).where(QueryVideo.query_id == query_id))
    bvids = [r[0] for r in qv_result.all()]

    # Delete query (cascades QueryVideo)
    await db.delete(query)
    await db.flush()

    # Clean up orphaned videos
    for bvid in bvids:
        remaining = await db.execute(
            select(func.count()).select_from(QueryVideo).where(QueryVideo.bvid == bvid)
        )
        if remaining.scalar() == 0:
            video = await db.get(Video, bvid)
            if video:
                await db.delete(video)  # cascades stats + content

    await db.commit()
    return {"status": "deleted"}
