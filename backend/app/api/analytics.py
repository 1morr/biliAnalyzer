import json
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video, VideoStats, VideoContent
from app.schemas.analytics import (
    StatsSummary, TrendPoint, InteractionData, VideoComparison,
    WordFrequencyResponse, WordDetailResponse, UserDemographicsResponse,
)
from app.services.wordcloud_svc import (
    compute_word_frequencies, compute_tag_frequencies, compute_user_frequencies,
    compute_location_frequencies, compute_user_demographics, extract_word_contexts,
    extract_user_comments, extract_location_comments, normalize_items, filter_items,
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


@router.get("/queries/{query_id}/stats/demographics", response_model=UserDemographicsResponse)
async def query_demographics(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404)
    rows = await _query_video_content_rows(db, query_id)
    items = _gather_query_normalized_items(rows, "comment")
    demographics = compute_user_demographics(items)
    demographics["location_distribution"] = compute_location_frequencies(items)
    return UserDemographicsResponse(**demographics)


@router.get("/videos/{bvid}/stats/demographics", response_model=UserDemographicsResponse)
async def video_demographics(bvid: str, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content = await _video_content(db, bvid)
    items = _gather_video_comment_items(content)
    demographics = compute_user_demographics(items)
    demographics["location_distribution"] = compute_location_frequencies(items)
    return UserDemographicsResponse(**demographics)


QUERY_WC_TYPES = {"content", "title", "tag", "danmaku", "comment", "interaction", "user", "subtitle", "location"}
VIDEO_WC_TYPES = {"content", "title", "tag", "subtitle", "danmaku", "comment", "interaction", "user", "location"}


def _parse_filter_param(value: str | None) -> list[str] | None:
    """Parse comma-separated filter param to list, or None if empty."""
    if not value:
        return None
    parts = [v.strip() for v in value.split(",") if v.strip()]
    return parts or None


@router.get("/queries/{query_id}/wordcloud/{wc_type}", response_model=WordFrequencyResponse)
async def query_wordcloud(
    query_id: int, wc_type: str,
    gender: str | None = QueryParam(None),
    vip: str | None = QueryParam(None),
    level: str | None = QueryParam(None),
    location: str | None = QueryParam(None),
    db: AsyncSession = Depends(get_db),
):
    if wc_type not in QUERY_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {QUERY_WC_TYPES}")

    rows = await _query_video_content_rows(db, query_id)
    has_filters = any([gender, vip, level, location])

    if wc_type == "user":
        items = _gather_query_normalized_items(rows, "comment")
        if has_filters:
            items = filter_items(items, _parse_filter_param(gender), _parse_filter_param(vip), _parse_filter_param(level), _parse_filter_param(location))
        words = compute_user_frequencies(items)
    elif wc_type == "comment":
        items = _gather_query_normalized_items(rows, "comment")
        if has_filters:
            items = filter_items(items, _parse_filter_param(gender), _parse_filter_param(vip), _parse_filter_param(level), _parse_filter_param(location))
        words = compute_word_frequencies([item["text"] for item in items if item.get("text")])
    elif wc_type == "location":
        items = _gather_query_normalized_items(rows, "comment")
        words = compute_location_frequencies(items)
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
    gender: str | None = QueryParam(None),
    vip: str | None = QueryParam(None),
    level: str | None = QueryParam(None),
    location: str | None = QueryParam(None),
    db: AsyncSession = Depends(get_db),
):
    if wc_type not in QUERY_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {QUERY_WC_TYPES}")

    rows = await _query_video_content_rows(db, query_id)
    has_filters = any([gender, vip, level, location])

    if wc_type in ("user", "comment") and has_filters:
        annotated = _gather_query_annotated_texts_with_video(rows, "comment")
        filtered = filter_items(annotated, _parse_filter_param(gender), _parse_filter_param(vip), _parse_filter_param(level), _parse_filter_param(location))
        tuples = [(it["bvid"], it["title"], it["text"], it.get("user"), it.get("source"), it.get("location"), it.get("uid")) for it in filtered]
        if wc_type == "user":
            videos = extract_user_comments(tuples, word)
        else:
            videos = extract_word_contexts(tuples, word)
    elif wc_type == "user":
        annotated = _gather_query_annotated_texts(rows, "comment")
        videos = extract_user_comments(annotated, word)
    elif wc_type == "location":
        annotated = _gather_query_annotated_texts(rows, "comment")
        videos = extract_location_comments(annotated, word)
    else:
        annotated = _gather_query_annotated_texts(rows, wc_type)
        videos = extract_word_contexts(annotated, word)

    total_count = sum(v["count"] for v in videos)
    return WordDetailResponse(word=word, total_count=total_count, videos=videos)


@router.get("/videos/{bvid}/wordcloud/{wc_type}", response_model=WordFrequencyResponse)
async def video_wordcloud(
    bvid: str, wc_type: str,
    gender: str | None = QueryParam(None),
    vip: str | None = QueryParam(None),
    level: str | None = QueryParam(None),
    location: str | None = QueryParam(None),
    db: AsyncSession = Depends(get_db),
):
    if wc_type not in VIDEO_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {VIDEO_WC_TYPES}")

    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content = await _video_content(db, bvid)
    has_filters = any([gender, vip, level, location])

    if wc_type == "user":
        items = _gather_video_normalized_items(video, content)
        if has_filters:
            items = filter_items(items, _parse_filter_param(gender), _parse_filter_param(vip), _parse_filter_param(level), _parse_filter_param(location))
        words = compute_user_frequencies(items)
    elif wc_type == "comment":
        items = _gather_video_comment_items(content)
        if has_filters:
            items = filter_items(items, _parse_filter_param(gender), _parse_filter_param(vip), _parse_filter_param(level), _parse_filter_param(location))
        words = compute_word_frequencies([item["text"] for item in items if item.get("text")])
    elif wc_type == "location":
        items = _gather_video_normalized_items(video, content)
        words = compute_location_frequencies(items)
    elif wc_type == "tag":
        texts = _gather_video_texts(video, content, wc_type)
        if not texts:
            raise HTTPException(status_code=404, detail="No data available")
        words = compute_tag_frequencies(texts)
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
    gender: str | None = QueryParam(None),
    vip: str | None = QueryParam(None),
    level: str | None = QueryParam(None),
    location: str | None = QueryParam(None),
    db: AsyncSession = Depends(get_db),
):
    if wc_type not in VIDEO_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {VIDEO_WC_TYPES}")

    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content = await _video_content(db, bvid)
    has_filters = any([gender, vip, level, location])

    if wc_type in ("user", "comment") and has_filters:
        annotated = _gather_video_annotated_texts_with_video(video, content, "interaction")
        filtered = filter_items(annotated, _parse_filter_param(gender), _parse_filter_param(vip), _parse_filter_param(level), _parse_filter_param(location))
        tuples = [(it["bvid"], it["title"], it["text"], it.get("user"), it.get("source"), it.get("location"), it.get("uid")) for it in filtered]
        if wc_type == "user":
            videos = extract_user_comments(tuples, word)
        else:
            videos = extract_word_contexts(tuples, word)
    elif wc_type == "user":
        annotated = _gather_video_annotated_texts(video, content, "interaction")
        videos = extract_user_comments(annotated, word)
    elif wc_type == "location":
        annotated = _gather_video_annotated_texts(video, content, "interaction")
        videos = extract_location_comments(annotated, word)
    else:
        annotated = _gather_video_annotated_texts(video, content, wc_type)
        videos = extract_word_contexts(annotated, word)

    total_count = sum(v["count"] for v in videos)
    return WordDetailResponse(word=word, total_count=total_count, videos=videos)


# --- Helper functions ---

async def _query_video_content_rows(db: AsyncSession, query_id: int) -> list:
    result = await db.execute(
        select(Video, VideoContent)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .outerjoin(VideoContent, VideoContent.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    return result.all()


async def _video_content(db: AsyncSession, bvid: str) -> VideoContent | None:
    result = await db.execute(select(VideoContent).where(VideoContent.bvid == bvid))
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
    texts = []
    for item in raw_items:
        if isinstance(item, str):
            if item:
                texts.append(item)
        elif isinstance(item, dict):
            text = item.get("text", "")
            if text:
                texts.append(text)
    return texts


def _gather_query_texts(rows: list, wc_type: str) -> list[str]:
    """Gather flat text list from query video rows."""
    texts = []
    for video, content in rows:
        if wc_type == "content":
            texts.append(video.title or "")
            texts.extend((video.tags or "").split(","))
            if content and content.subtitle:
                texts.append(content.subtitle)
        elif wc_type == "title":
            texts.append(video.title or "")
        elif wc_type == "tag":
            texts.extend((video.tags or "").split(","))
        elif wc_type == "subtitle" and content and content.subtitle:
            texts.append(content.subtitle)
        elif wc_type == "interaction" and content:
            if content.danmakus:
                texts.extend(_extract_texts_from_items(_safe_json_loads(content.danmakus)))
            if content.comments:
                texts.extend(_extract_texts_from_items(_safe_json_loads(content.comments)))
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
    """Gather (bvid, title, text, user, source, location) tuples preserving per-item grouping."""
    annotated: list[tuple] = []
    for video, content in rows:
        bvid = video.bvid
        title = video.title or bvid
        if wc_type == "content":
            annotated.append((bvid, title, video.title or "", None, "title", None))
            annotated.append((bvid, title, (video.tags or "").replace(",", " "), None, "tag", None))
            if content and content.subtitle:
                annotated.append((bvid, title, content.subtitle, None, "subtitle", None))
        elif wc_type == "title":
            annotated.append((bvid, title, video.title or "", None, "title", None))
        elif wc_type == "tag":
            annotated.append((bvid, title, (video.tags or "").replace(",", " "), None, "tag", None))
        elif wc_type == "subtitle" and content and content.subtitle:
            annotated.append((bvid, title, content.subtitle, None, "subtitle", None))
        elif wc_type == "interaction" and content:
            if content.danmakus:
                for item in normalize_items(_safe_json_loads(content.danmakus)):
                    annotated.append((bvid, title, item["text"], item["user"], "danmaku", item.get("location"), item.get("uid")))
            if content.comments:
                for item in normalize_items(_safe_json_loads(content.comments)):
                    annotated.append((bvid, title, item["text"], item["user"], "comment", item.get("location"), item.get("uid")))
        elif wc_type == "danmaku" and content and content.danmakus:
            for item in normalize_items(_safe_json_loads(content.danmakus)):
                annotated.append((bvid, title, item["text"], item["user"], "danmaku", item.get("location"), item.get("uid")))
        elif wc_type == "comment" and content and content.comments:
            for item in normalize_items(_safe_json_loads(content.comments)):
                annotated.append((bvid, title, item["text"], item["user"], "comment", item.get("location"), item.get("uid")))
    return annotated


def _gather_video_texts(video: Video, content: VideoContent | None, wc_type: str) -> list[str]:
    """Gather flat text list from a single video."""
    texts = []
    if wc_type == "content":
        texts.append(video.title or "")
        texts.extend((video.tags or "").split(","))
        if content and content.subtitle:
            texts.append(content.subtitle)
    elif wc_type == "title":
        texts.append(video.title or "")
    elif wc_type == "tag":
        texts.extend((video.tags or "").split(","))
    elif wc_type == "subtitle" and content and content.subtitle:
        texts.append(content.subtitle)
    elif wc_type == "interaction" and content:
        if content.danmakus:
            texts.extend(_extract_texts_from_items(_safe_json_loads(content.danmakus)))
        if content.comments:
            texts.extend(_extract_texts_from_items(_safe_json_loads(content.comments)))
    elif wc_type == "danmaku" and content and content.danmakus:
        texts.extend(_extract_texts_from_items(_safe_json_loads(content.danmakus)))
    elif wc_type == "comment" and content and content.comments:
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


def _gather_video_comment_items(content: VideoContent | None) -> list[dict]:
    if not content or not content.comments:
        return []
    return normalize_items(_safe_json_loads(content.comments))


def _gather_video_annotated_texts(
    video: Video, content: VideoContent | None, wc_type: str,
) -> list[tuple]:
    """Gather (bvid, title, text, user, source, location) tuples for a single video."""
    annotated: list[tuple] = []
    bvid = video.bvid
    title = video.title or bvid
    if wc_type == "content":
        annotated.append((bvid, title, video.title or "", None, "title", None))
        annotated.append((bvid, title, (video.tags or "").replace(",", " "), None, "tag", None))
        if content and content.subtitle:
            annotated.append((bvid, title, content.subtitle, None, "subtitle", None))
    elif wc_type == "title":
        annotated.append((bvid, title, video.title or "", None, "title", None))
    elif wc_type == "tag":
        annotated.append((bvid, title, (video.tags or "").replace(",", " "), None, "tag", None))
    elif wc_type == "subtitle" and content and content.subtitle:
        annotated.append((bvid, title, content.subtitle, None, "subtitle", None))
    elif wc_type == "interaction" and content:
        if content.danmakus:
            for item in normalize_items(_safe_json_loads(content.danmakus)):
                annotated.append((bvid, title, item["text"], item["user"], "danmaku", item.get("location"), item.get("uid")))
        if content.comments:
            for item in normalize_items(_safe_json_loads(content.comments)):
                annotated.append((bvid, title, item["text"], item["user"], "comment", item.get("location"), item.get("uid")))
    elif wc_type == "danmaku" and content and content.danmakus:
        for item in normalize_items(_safe_json_loads(content.danmakus)):
            annotated.append((bvid, title, item["text"], item["user"], "danmaku", item.get("location"), item.get("uid")))
    elif wc_type == "comment" and content and content.comments:
        for item in normalize_items(_safe_json_loads(content.comments)):
            annotated.append((bvid, title, item["text"], item["user"], "comment", item.get("location"), item.get("uid")))
    return annotated


def _gather_query_annotated_texts_with_video(rows: list, source_type: str) -> list[dict]:
    """Gather normalized items with bvid/title metadata for filtered detail lookups."""
    all_items: list[dict] = []
    for video, content in rows:
        if not content:
            continue
        bvid = video.bvid
        title = video.title or bvid
        raw = None
        if source_type == "comment" and content.comments:
            raw = content.comments
        elif source_type == "danmaku" and content.danmakus:
            raw = content.danmakus
        if raw:
            for item in normalize_items(_safe_json_loads(raw)):
                item["bvid"] = bvid
                item["title"] = title
                item["source"] = source_type
                all_items.append(item)
    return all_items


def _gather_video_annotated_texts_with_video(
    video: Video, content: VideoContent | None, wc_type: str,
) -> list[dict]:
    """Gather normalized items with bvid/title for a single video (filtered detail lookups)."""
    items: list[dict] = []
    if not content:
        return items
    bvid = video.bvid
    title = video.title or bvid
    if wc_type in ("interaction", "comment") and content.comments:
        for item in normalize_items(_safe_json_loads(content.comments)):
            item["bvid"] = bvid
            item["title"] = title
            item["source"] = "comment"
            items.append(item)
    if wc_type in ("interaction", "danmaku") and content.danmakus:
        for item in normalize_items(_safe_json_loads(content.danmakus)):
            item["bvid"] = bvid
            item["title"] = title
            item["source"] = "danmaku"
            items.append(item)
    return items
