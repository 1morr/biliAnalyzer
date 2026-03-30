import json
from collections import defaultdict
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video, VideoStats, VideoContent
from app.schemas.analytics import StatsSummary, TrendPoint, InteractionData, VideoComparison
from app.services.wordcloud_svc import generate_wordcloud
from app.core.config import settings as app_settings

router = APIRouter()


@router.get("/queries/{query_id}/stats/summary", response_model=StatsSummary)
async def stats_summary(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404)
    return StatsSummary(
        total_views=query.total_views, total_likes=query.total_likes,
        total_coins=query.total_coins, total_favorites=query.total_favorites,
        total_shares=query.total_shares, total_danmaku=query.total_danmaku,
        total_comments=query.total_comments, video_count=query.video_count,
    )


@router.get("/queries/{query_id}/stats/trend", response_model=list[TrendPoint])
async def stats_trend(query_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()

    # Latest stats per video, grouped by publish month
    latest: dict[str, tuple[Video, VideoStats]] = {}
    for video, stats in rows:
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid][1].fetched_at:
            latest[video.bvid] = (video, stats)

    monthly: dict[str, int] = defaultdict(int)
    for video, stats in latest.values():
        if video.published_at:
            key = video.published_at.strftime("%Y-%m")
            monthly[key] += stats.views

    return [TrendPoint(date=k, views=v) for k, v in sorted(monthly.items())]


@router.get("/queries/{query_id}/stats/interaction", response_model=InteractionData)
async def stats_interaction(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404)
    return InteractionData(
        likes=query.total_likes, coins=query.total_coins,
        favorites=query.total_favorites, shares=query.total_shares,
    )


@router.get("/videos/{bvid}/stats/comparison", response_model=VideoComparison)
async def video_comparison(
    bvid: str,
    query_id: int = QueryParam(...),
    db: AsyncSession = Depends(get_db),
):
    # Get this video's latest stats
    stats_result = await db.execute(
        select(VideoStats).where(VideoStats.bvid == bvid).order_by(VideoStats.fetched_at.desc()).limit(1)
    )
    video_stats = stats_result.scalar_one_or_none()
    if not video_stats:
        raise HTTPException(status_code=404)

    # Get query averages
    all_result = await db.execute(
        select(VideoStats)
        .join(QueryVideo, QueryVideo.bvid == VideoStats.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    all_stats = all_result.scalars().all()

    latest_per: dict[str, VideoStats] = {}
    for s in all_stats:
        if s.bvid not in latest_per or s.fetched_at > latest_per[s.bvid].fetched_at:
            latest_per[s.bvid] = s

    count = len(latest_per) or 1
    metrics = ["views", "likes", "coins", "favorites", "shares", "danmaku_count", "comment_count"]
    labels = ["Views", "Likes", "Coins", "Favorites", "Shares", "Danmaku", "Comments"]

    video_values = [float(getattr(video_stats, m)) for m in metrics]
    avg_values = [sum(getattr(s, m) for s in latest_per.values()) / count for m in metrics]
    pct_diff = [
        round((v - a) / a * 100, 1) if a > 0 else 0.0
        for v, a in zip(video_values, avg_values)
    ]

    return VideoComparison(
        metrics=labels, video_values=video_values,
        average_values=[round(a, 1) for a in avg_values],
        percentage_diff=pct_diff,
    )


QUERY_WC_TYPES = {"title", "tag", "danmaku", "comment"}
VIDEO_WC_TYPES = {"content", "interaction"}


@router.get("/queries/{query_id}/wordcloud/{wc_type}")
async def query_wordcloud(query_id: int, wc_type: str, db: AsyncSession = Depends(get_db)):
    if wc_type not in QUERY_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {QUERY_WC_TYPES}")

    cache_path = Path(app_settings.DATA_DIR) / "wordclouds" / f"{query_id}_{wc_type}.png"
    if cache_path.exists():
        return FileResponse(cache_path, media_type="image/png")

    # Gather texts
    result = await db.execute(
        select(Video, VideoContent)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .outerjoin(VideoContent, VideoContent.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()

    texts = []
    for video, content in rows:
        if wc_type == "title":
            texts.append(video.title or "")
        elif wc_type == "tag":
            texts.extend((video.tags or "").split(","))
        elif wc_type == "danmaku" and content and content.danmakus:
            texts.extend(json.loads(content.danmakus))
        elif wc_type == "comment" and content and content.comments:
            texts.extend(json.loads(content.comments))

    if not texts:
        raise HTTPException(status_code=404, detail="No data available for word cloud")

    output = generate_wordcloud(texts, str(cache_path))
    if not output:
        raise HTTPException(status_code=404, detail="Not enough text data")
    return FileResponse(cache_path, media_type="image/png")


@router.get("/videos/{bvid}/wordcloud/{wc_type}")
async def video_wordcloud(bvid: str, wc_type: str, db: AsyncSession = Depends(get_db)):
    if wc_type not in VIDEO_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {VIDEO_WC_TYPES}")

    cache_path = Path(app_settings.DATA_DIR) / "wordclouds" / f"{bvid}_{wc_type}.png"
    if cache_path.exists():
        return FileResponse(cache_path, media_type="image/png")

    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content_result = await db.execute(
        select(VideoContent).where(VideoContent.bvid == bvid).order_by(VideoContent.fetched_at.desc()).limit(1)
    )
    content = content_result.scalar_one_or_none()

    texts = []
    if wc_type == "content":
        texts.append(video.title or "")
        texts.extend((video.tags or "").split(","))
        if content and content.subtitle:
            texts.append(content.subtitle)
    elif wc_type == "interaction":
        if content:
            if content.danmakus:
                texts.extend(json.loads(content.danmakus))
            if content.comments:
                texts.extend(json.loads(content.comments))

    if not texts:
        raise HTTPException(status_code=404, detail="No data available")

    output = generate_wordcloud(texts, str(cache_path))
    if not output:
        raise HTTPException(status_code=404, detail="Not enough text data")
    return FileResponse(cache_path, media_type="image/png")
