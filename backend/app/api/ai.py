# backend/app/api/ai.py
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from openai import AsyncOpenAI
from app.core.deps import get_db
from app.models import Query, QueryVideo, VideoStats, Video, AppSettings
from app.core.security import decrypt_value
from app.services.ai_analysis import build_analysis_prompt, stream_analysis

router = APIRouter()


@router.post("/queries/{query_id}/ai/analyze")
async def ai_analyze(query_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query or query.status != "done":
        raise HTTPException(status_code=400, detail="Query not ready")

    # Get AI settings
    base_url_row = await db.get(AppSettings, "ai_base_url")
    api_key_row = await db.get(AppSettings, "ai_api_key")
    model_row = await db.get(AppSettings, "ai_model")

    base_url = base_url_row.value if base_url_row else "https://api.openai.com/v1"
    api_key = ""
    if api_key_row and api_key_row.value:
        api_key = decrypt_value(api_key_row.value) if api_key_row.is_sensitive else api_key_row.value
    model = model_row.value if model_row else "gpt-4o"

    if not api_key:
        raise HTTPException(status_code=400, detail="AI API key not configured")

    # Gather video data
    result = await db.execute(
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()

    latest: dict[str, dict] = {}
    for video, stats in rows:
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid].get("_fetched_at", stats.fetched_at):
            latest[video.bvid] = {
                "title": video.title, "tags": video.tags,
                "views": stats.views, "likes": stats.likes,
                "coins": stats.coins, "favorites": stats.favorites,
                "shares": stats.shares, "_fetched_at": stats.fetched_at,
            }

    videos_data = list(latest.values())
    summary = {
        "video_count": query.video_count, "total_views": query.total_views,
        "total_likes": query.total_likes, "total_coins": query.total_coins,
        "total_favorites": query.total_favorites,
    }

    # Detect language from Accept-Language header
    lang = "zh"
    accept_lang = request.headers.get("Accept-Language", "")
    if accept_lang.startswith("en"):
        lang = "en"

    messages = build_analysis_prompt(videos_data, summary, lang)

    client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def event_generator():
        try:
            async for chunk in stream_analysis(client, model, messages):
                yield {"event": "message", "data": json.dumps({"content": chunk})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())
