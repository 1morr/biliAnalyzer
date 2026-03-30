import math
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Video, VideoStats, VideoContent, QueryVideo
from app.schemas.video import VideoDetail, VideoSummary, VideoStatsSchema, PaginatedVideos

router = APIRouter()


def _compute_interaction_rate(s: VideoStats) -> float:
    if not s.views:
        return 0.0
    return round((s.likes + s.coins + s.favorites + s.shares) / s.views * 100, 2)


def _stats_to_schema(s: VideoStats) -> VideoStatsSchema:
    return VideoStatsSchema(
        views=s.views, likes=s.likes, coins=s.coins,
        favorites=s.favorites, shares=s.shares,
        danmaku_count=s.danmaku_count, comment_count=s.comment_count,
        interaction_rate=_compute_interaction_rate(s),
    )


SORT_FIELDS = {
    "views": VideoStats.views, "likes": VideoStats.likes,
    "coins": VideoStats.coins, "favorites": VideoStats.favorites,
    "shares": VideoStats.shares, "danmaku": VideoStats.danmaku_count,
    "comments": VideoStats.comment_count, "published_at": Video.published_at,
}


@router.get("/queries/{query_id}/videos", response_model=PaginatedVideos)
async def list_videos(
    query_id: int,
    sort_by: str = "views",
    order: str = "desc",
    page: int = 1,
    page_size: int = QueryParam(default=20, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Build query: join Video + latest VideoStats via QueryVideo
    base = (
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    result = await db.execute(base)
    rows = result.all()

    # Keep latest stats per video
    latest: dict[str, tuple[Video, VideoStats]] = {}
    for video, stats in rows:
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid][1].fetched_at:
            latest[video.bvid] = (video, stats)

    items = list(latest.values())

    # Sort
    sort_key = sort_by if sort_by in SORT_FIELDS else "views"
    if sort_key == "published_at":
        items.sort(key=lambda x: x[0].published_at or 0, reverse=(order == "desc"))
    else:
        field_name = sort_key if sort_key != "danmaku" else "danmaku_count"
        field_name = field_name if field_name != "comments" else "comment_count"
        items.sort(key=lambda x: getattr(x[1], field_name, 0), reverse=(order == "desc"))

    total = len(items)
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    page_items = items[(page - 1) * page_size : page * page_size]

    return PaginatedVideos(
        items=[
            VideoSummary(
                bvid=v.bvid, title=v.title, cover_url=v.cover_url,
                duration=v.duration, published_at=v.published_at,
                tags=v.tags, stats=_stats_to_schema(s),
            )
            for v, s in page_items
        ],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    )


@router.get("/videos/{bvid}", response_model=VideoDetail)
async def get_video(bvid: str, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    stats_result = await db.execute(
        select(VideoStats).where(VideoStats.bvid == bvid).order_by(VideoStats.fetched_at.desc()).limit(1)
    )
    stats = stats_result.scalar_one_or_none()
    if not stats:
        raise HTTPException(status_code=404, detail="No stats found")

    content_result = await db.execute(
        select(VideoContent).where(VideoContent.bvid == bvid).order_by(VideoContent.fetched_at.desc()).limit(1)
    )
    content = content_result.scalar_one_or_none()

    return VideoDetail(
        bvid=video.bvid, aid=video.aid, cid=video.cid,
        title=video.title, description=video.description,
        cover_url=video.cover_url, duration=video.duration,
        published_at=video.published_at, tags=video.tags,
        stats=_stats_to_schema(stats),
        has_danmaku=bool(content and content.danmakus and content.danmakus != "[]"),
        has_subtitle=bool(content and content.subtitle),
    )
