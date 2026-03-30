import json
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video, VideoStats, VideoContent
from app.schemas.analytics import (
    StatsSummary, TrendPoint, InteractionData, VideoComparison,
    WordFrequencyResponse, WordDetailResponse,
)
from app.services.wordcloud_svc import (
    compute_word_frequencies, compute_tag_frequencies, compute_user_frequencies,
    extract_word_contexts, extract_user_comments, normalize_items,
)

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

    # Collect publish dates to determine time span
    dates = [video.published_at for video, _ in latest.values() if video.published_at]
    if not dates:
        return []

    min_date, max_date = min(dates), max(dates)
    span_days = (max_date - min_date).days

    # Auto-adaptive granularity
    if span_days <= 31:
        fmt = "%Y-%m-%d"       # daily
    elif span_days <= 180:
        fmt = "week"           # weekly (special handling below)
    else:
        fmt = "%Y-%m"          # monthly

    bucket: dict[str, int] = defaultdict(int)
    for video, stats in latest.values():
        if video.published_at:
            if fmt == "week":
                iso = video.published_at.isocalendar()
                key = f"{iso[0]}-W{iso[1]:02d}"
            else:
                key = video.published_at.strftime(fmt)
            bucket[key] += stats.views

    return [TrendPoint(date=k, views=v) for k, v in sorted(bucket.items())]


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
    labels = ["views", "likes", "coins", "favorites", "shares", "danmaku", "comments"]

    video_values = [float(getattr(video_stats, m)) for m in metrics]
    avg_values = [sum(getattr(s, m) for s in latest_per.values()) / count for m in metrics]
    max_values = [max(getattr(s, m) for s in latest_per.values()) for m in metrics]
    pct_diff = [
        round((v - a) / a * 100, 1) if a > 0 else 0.0
        for v, a in zip(video_values, avg_values)
    ]

    return VideoComparison(
        metrics=labels, video_values=video_values,
        average_values=[round(a, 1) for a in avg_values],
        max_values=[round(m, 1) for m in max_values],
        percentage_diff=pct_diff,
    )


QUERY_WC_TYPES = {"title", "tag", "danmaku", "comment", "user"}
VIDEO_WC_TYPES = {"content", "interaction", "user"}


@router.get("/queries/{query_id}/wordcloud/{wc_type}", response_model=WordFrequencyResponse)
async def query_wordcloud(query_id: int, wc_type: str, db: AsyncSession = Depends(get_db)):
    if wc_type not in QUERY_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {QUERY_WC_TYPES}")

    rows = await _query_video_content_rows(db, query_id)

    if wc_type == "user":
        items = _gather_query_normalized_items(rows, "comment")
        words = compute_user_frequencies(items)
    elif wc_type == "tag":
        texts = _gather_query_texts(rows, wc_type)
        if not texts:
            raise HTTPException(status_code=404, detail="No data available for word cloud")
        words = compute_tag_frequencies(texts)
    else:
        texts = _gather_query_texts(rows, wc_type)
        if not texts:
            raise HTTPException(status_code=404, detail="No data available for word cloud")
        words = compute_word_frequencies(texts)

    if not words:
        raise HTTPException(status_code=404, detail="Not enough data")
    return WordFrequencyResponse(words=words)


@router.get("/queries/{query_id}/wordcloud/{wc_type}/detail", response_model=WordDetailResponse)
async def query_wordcloud_detail(
    query_id: int, wc_type: str,
    word: str = QueryParam(...),
    db: AsyncSession = Depends(get_db),
):
    if wc_type not in QUERY_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {QUERY_WC_TYPES}")

    rows = await _query_video_content_rows(db, query_id)

    if wc_type == "user":
        annotated = _gather_query_annotated_texts(rows, "comment")
        videos = extract_user_comments(annotated, word)
    else:
        annotated = _gather_query_annotated_texts(rows, wc_type)
        videos = extract_word_contexts(annotated, word)

    total_count = sum(v["count"] for v in videos)
    return WordDetailResponse(word=word, total_count=total_count, videos=videos)


@router.get("/videos/{bvid}/wordcloud/{wc_type}", response_model=WordFrequencyResponse)
async def video_wordcloud(bvid: str, wc_type: str, db: AsyncSession = Depends(get_db)):
    if wc_type not in VIDEO_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {VIDEO_WC_TYPES}")

    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content = await _latest_video_content(db, bvid)

    if wc_type == "user":
        items = _gather_video_normalized_items(video, content)
        words = compute_user_frequencies(items)
    else:
        texts = _gather_video_texts(video, content, wc_type)
        if not texts:
            raise HTTPException(status_code=404, detail="No data available")
        words = compute_word_frequencies(texts)

    if not words:
        raise HTTPException(status_code=404, detail="Not enough data")
    return WordFrequencyResponse(words=words)


@router.get("/videos/{bvid}/wordcloud/{wc_type}/detail", response_model=WordDetailResponse)
async def video_wordcloud_detail(
    bvid: str, wc_type: str,
    word: str = QueryParam(...),
    db: AsyncSession = Depends(get_db),
):
    if wc_type not in VIDEO_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {VIDEO_WC_TYPES}")

    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content = await _latest_video_content(db, bvid)

    if wc_type == "user":
        annotated = _gather_video_annotated_texts(video, content, "interaction")
        videos = extract_user_comments(annotated, word)
    else:
        annotated = _gather_video_annotated_texts(video, content, wc_type)
        videos = extract_word_contexts(annotated, word)

    total_count = sum(v["count"] for v in videos)
    return WordDetailResponse(word=word, total_count=total_count, videos=videos)


# --- Helper functions ---

async def _query_video_content_rows(db: AsyncSession, query_id: int) -> list:
    """Fetch deduplicated (Video, VideoContent) rows for a query."""
    result = await db.execute(
        select(Video, VideoContent)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .outerjoin(VideoContent, VideoContent.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()
    # Deduplicate: keep first occurrence per bvid
    seen: set[str] = set()
    deduped = []
    for video, content in rows:
        if video.bvid not in seen:
            seen.add(video.bvid)
            deduped.append((video, content))
    return deduped


async def _latest_video_content(db: AsyncSession, bvid: str) -> VideoContent | None:
    result = await db.execute(
        select(VideoContent).where(VideoContent.bvid == bvid).order_by(VideoContent.fetched_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _safe_json_loads(raw: str) -> list:
    """Safely parse a JSON array, returning empty list on failure."""
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _extract_texts_from_items(raw_items: list) -> list[str]:
    """Extract plain text strings from items (handles both old and new format)."""
    items = normalize_items(raw_items)
    return [item["text"] for item in items if item["text"]]


def _gather_query_texts(rows: list, wc_type: str) -> list[str]:
    """Gather flat text list from query video rows."""
    texts = []
    for video, content in rows:
        if wc_type == "title":
            texts.append(video.title or "")
        elif wc_type == "tag":
            texts.extend((video.tags or "").split(","))
        elif wc_type == "danmaku" and content and content.danmakus:
            texts.extend(_extract_texts_from_items(_safe_json_loads(content.danmakus)))
        elif wc_type == "comment" and content and content.comments:
            texts.extend(_extract_texts_from_items(_safe_json_loads(content.comments)))
    return texts


def _gather_query_normalized_items(rows: list, source_type: str) -> list[dict]:
    """Gather normalized [{"text", "user"}] items from query rows for a given source."""
    all_items: list[dict] = []
    for video, content in rows:
        if not content:
            continue
        if source_type == "comment" and content.comments:
            all_items.extend(normalize_items(_safe_json_loads(content.comments)))
        elif source_type == "danmaku" and content.danmakus:
            all_items.extend(normalize_items(_safe_json_loads(content.danmakus)))
    return all_items


def _gather_query_annotated_texts(rows: list, wc_type: str) -> list[tuple]:
    """Gather (bvid, title, text, user, source) tuples preserving per-item grouping."""
    annotated: list[tuple] = []
    for video, content in rows:
        bvid = video.bvid
        title = video.title or bvid
        if wc_type == "title":
            annotated.append((bvid, title, video.title or "", None, None))
        elif wc_type == "tag":
            annotated.append((bvid, title, (video.tags or "").replace(",", " "), None, None))
        elif wc_type == "danmaku" and content and content.danmakus:
            for item in normalize_items(_safe_json_loads(content.danmakus)):
                annotated.append((bvid, title, item["text"], item["user"], "danmaku"))
        elif wc_type == "comment" and content and content.comments:
            for item in normalize_items(_safe_json_loads(content.comments)):
                annotated.append((bvid, title, item["text"], item["user"], "comment"))
    return annotated


def _gather_video_texts(video: Video, content: VideoContent | None, wc_type: str) -> list[str]:
    """Gather flat text list from a single video."""
    texts = []
    if wc_type == "content":
        texts.append(video.title or "")
        texts.extend((video.tags or "").split(","))
        if content and content.subtitle:
            texts.append(content.subtitle)
    elif wc_type == "interaction":
        if content:
            if content.danmakus:
                texts.extend(_extract_texts_from_items(_safe_json_loads(content.danmakus)))
            if content.comments:
                texts.extend(_extract_texts_from_items(_safe_json_loads(content.comments)))
    return texts


def _gather_video_normalized_items(video: Video, content: VideoContent | None) -> list[dict]:
    """Gather all normalized comment+danmaku items for a video (for user frequency)."""
    items: list[dict] = []
    if content:
        if content.comments:
            items.extend(normalize_items(_safe_json_loads(content.comments)))
        if content.danmakus:
            items.extend(normalize_items(_safe_json_loads(content.danmakus)))
    return items


def _gather_video_annotated_texts(
    video: Video, content: VideoContent | None, wc_type: str,
) -> list[tuple]:
    """Gather (bvid, title, text, user, source) tuples for a single video."""
    annotated: list[tuple] = []
    bvid = video.bvid
    title = video.title or bvid
    if wc_type == "content":
        annotated.append((bvid, title, video.title or "", None, None))
        annotated.append((bvid, title, (video.tags or "").replace(",", " "), None, None))
        if content and content.subtitle:
            annotated.append((bvid, title, content.subtitle, None, None))
    elif wc_type == "interaction":
        if content:
            if content.danmakus:
                for item in normalize_items(_safe_json_loads(content.danmakus)):
                    annotated.append((bvid, title, item["text"], item["user"], "danmaku"))
            if content.comments:
                for item in normalize_items(_safe_json_loads(content.comments)):
                    annotated.append((bvid, title, item["text"], item["user"], "comment"))
    return annotated
