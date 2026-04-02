"""OpenAI function-calling tool definitions and executor for the AI agent."""
import json
import random
from collections import Counter, defaultdict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Query, QueryVideo, Video, VideoStats, VideoContent, VideoSentiment
from app.services.wordcloud_svc import (
    compute_word_frequencies, compute_tag_frequencies, normalize_items,
)


# ---------------------------------------------------------------------------
# Tool definitions (OpenAI function calling format)
# ---------------------------------------------------------------------------

TOOL_GET_STATS_SUMMARY = {
    "type": "function",
    "function": {
        "name": "get_stats_summary",
        "description": "Get aggregate statistics for the query: total views, likes, coins, favorites, shares, danmaku, comments, and video count.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

TOOL_GET_VIEWS_TREND = {
    "type": "function",
    "function": {
        "name": "get_views_trend",
        "description": "Get views grouped by publish date (auto-adaptive: daily/weekly/monthly). Returns [{date, views}].",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

TOOL_LIST_QUERY_VIDEOS = {
    "type": "function",
    "function": {
        "name": "list_query_videos",
        "description": "List all videos in the current query with basic stats. Returns bvid, title, published_at, duration, views, likes, coins, favorites, shares, danmaku_count, comment_count for each video, sorted by publish date descending. No parameters needed — uses the current query context.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

TOOL_GET_SAMPLE_COMMENTS = {
    "type": "function",
    "function": {
        "name": "get_sample_comments",
        "description": "Get sample comments or danmaku texts. Use this to read what users actually said — for qualitative analysis, quoting user feedback, or understanding audience sentiment in their own words.",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "enum": ["comment", "danmaku"],
                    "description": "Type of content to sample",
                },
                "bvid": {
                    "type": "string",
                    "description": "Optional: sample from a specific video. If omitted, samples across all videos in the query.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of items to return (default 20, max 50)",
                },
                "sort_by": {
                    "type": "string",
                    "enum": ["likes", "newest"],
                    "description": "Sort order for comments (ignored for danmaku). Default: likes",
                },
            },
            "required": ["source"],
        },
    },
}

TOOL_GET_TOP_VIDEOS = {
    "type": "function",
    "function": {
        "name": "get_top_videos",
        "description": "Get top or bottom N videos sorted by a metric. Returns title, bvid, tags, and stats.",
        "parameters": {
            "type": "object",
            "properties": {
                "sort_by": {
                    "type": "string",
                    "enum": ["views", "likes", "coins", "favorites", "shares", "danmaku_count", "comment_count"],
                    "description": "Metric to sort by",
                },
                "order": {
                    "type": "string", "enum": ["desc", "asc"],
                    "description": "Sort order. desc=top, asc=bottom",
                },
                "limit": {
                    "type": "integer", "description": "Number of videos to return (default 5, max 20)",
                },
            },
            "required": ["sort_by"],
        },
    },
}

TOOL_GET_VIDEO_COMPARISON = {
    "type": "function",
    "function": {
        "name": "get_video_comparison",
        "description": "Compare a specific video's stats against the query average. Returns each metric with video value, average, and diff percentage.",
        "parameters": {
            "type": "object",
            "properties": {
                "bvid": {
                    "type": "string",
                    "description": "The video BV number to compare. If omitted, uses the current video context.",
                },
            },
            "required": [],
        },
    },
}

TOOL_GET_DEMOGRAPHICS_SUMMARY = {
    "type": "function",
    "function": {
        "name": "get_demographics_summary",
        "description": "Get audience demographics: gender, VIP, user level, and location distributions.",
        "parameters": {
            "type": "object",
            "properties": {
                "bvid": {
                    "type": "string",
                    "description": "Analyze a specific video's audience. If omitted, analyzes all videos in the query.",
                },
            },
            "required": [],
        },
    },
}

TOOL_GET_WORD_FREQUENCIES = {
    "type": "function",
    "function": {
        "name": "get_word_frequencies",
        "description": "Get top word frequencies by type. Returns [{name, value}].",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "enum": ["title", "tag", "danmaku", "comment", "subtitle"],
                    "description": "Which text source to analyze",
                },
                "bvid": {
                    "type": "string",
                    "description": "Analyze a specific video. If omitted, analyzes all videos in the query.",
                },
            },
            "required": ["source"],
        },
    },
}

TOOL_GET_SENTIMENT_OVERVIEW = {
    "type": "function",
    "function": {
        "name": "get_sentiment_overview",
        "description": "Get sentiment analysis overview: average score and positive/neutral/negative percentages for danmaku and comments.",
        "parameters": {
            "type": "object",
            "properties": {
                "bvid": {
                    "type": "string",
                    "description": "Analyze a specific video's sentiment. If omitted, analyzes all videos in the query.",
                },
            },
            "required": [],
        },
    },
}

TOOL_GET_VIDEO_DETAIL = {
    "type": "function",
    "function": {
        "name": "get_video_detail",
        "description": "Get full information for a specific video: title, description, tags, duration, publish date, and all stats.",
        "parameters": {
            "type": "object",
            "properties": {
                "bvid": {
                    "type": "string",
                    "description": "The Bilibili video ID (BV number). If omitted and in video context, uses current video.",
                },
            },
            "required": [],
        },
    },
}

TOOL_LIST_QUERIES = {
    "type": "function",
    "function": {
        "name": "list_queries",
        "description": "List all query records in the database. Returns id, uid, user_name, date range, video_count, and aggregate stats for each query. Use this to discover available data for cross-query comparisons.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

TOOL_EXECUTE_SQL = {
    "type": "function",
    "function": {
        "name": "execute_sql",
        "description": (
            "Execute a read-only SQL SELECT query against the SQLite database. Returns up to 200 rows. "
            "Use this for custom queries that the predefined tools cannot handle.\n\n"
            "Tables:\n"
            "- queries (id, uid, user_name, start_date, end_date, status, video_count, total_views, total_likes, total_coins, total_favorites, total_shares, total_danmaku, total_comments, sentiment_status, created_at)\n"
            "- query_videos (id, query_id, bvid)\n"
            "- videos (bvid, aid, cid, uid, title, description, cover_url, duration, published_at, tags, created_at, updated_at)\n"
            "- video_stats (id, bvid, views, likes, coins, favorites, shares, danmaku_count, comment_count, fetched_at)\n"
            "- video_content (id, bvid, danmakus, comments, subtitle, fetched_at)\n"
            "- video_sentiment (id, bvid, analyzer, danmaku_avg_score, danmaku_positive_pct, danmaku_neutral_pct, danmaku_negative_pct, danmaku_count, comment_avg_score, comment_positive_pct, comment_neutral_pct, comment_negative_pct, comment_count, details, analyzed_at)\n\n"
            "Note: danmakus and comments columns contain large JSON arrays. Avoid selecting them in full unless necessary — use COUNT or targeted queries instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "A SQL SELECT query to execute. Only SELECT is allowed.",
                },
            },
            "required": ["sql"],
        },
    },
}

# All tools available to the AI agent
ALL_TOOLS = [
    TOOL_LIST_QUERY_VIDEOS, TOOL_GET_STATS_SUMMARY, TOOL_GET_VIEWS_TREND,
    TOOL_GET_TOP_VIDEOS, TOOL_GET_VIDEO_COMPARISON, TOOL_GET_DEMOGRAPHICS_SUMMARY,
    TOOL_GET_WORD_FREQUENCIES, TOOL_GET_SENTIMENT_OVERVIEW, TOOL_GET_VIDEO_DETAIL,
    TOOL_GET_SAMPLE_COMMENTS, TOOL_LIST_QUERIES, TOOL_EXECUTE_SQL,
]


def get_tools() -> list[dict]:
    """Return all tool definitions."""
    return ALL_TOOLS


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

def _safe_json_loads(raw: str | None) -> list:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _extract_texts(raw_items: list) -> list[str]:
    texts = []
    for item in raw_items:
        if isinstance(item, str) and item:
            texts.append(item)
        elif isinstance(item, dict):
            text = item.get("text", "")
            if text:
                texts.append(text)
    return texts


async def execute_tool(
    name: str, arguments: dict, db: AsyncSession, context: dict,
) -> str:
    """Execute a tool and return JSON string result."""
    query_id = context.get("query_id")
    bvid = context.get("bvid")

    try:
        if name == "list_query_videos":
            return await _exec_list_query_videos(db, query_id)
        elif name == "get_stats_summary":
            return await _exec_stats_summary(db, query_id)
        elif name == "get_views_trend":
            return await _exec_views_trend(db, query_id)
        elif name == "get_top_videos":
            return await _exec_top_videos(db, query_id, arguments)
        elif name == "get_video_comparison":
            return await _exec_video_comparison(db, query_id, arguments.get("bvid") or bvid)
        elif name == "get_demographics_summary":
            return await _exec_demographics(db, query_id, arguments.get("bvid") or bvid)
        elif name == "get_word_frequencies":
            return await _exec_word_frequencies(db, query_id, arguments.get("bvid") or bvid, arguments)
        elif name == "get_sentiment_overview":
            return await _exec_sentiment_overview(db, query_id, arguments.get("bvid") or bvid)
        elif name == "get_video_detail":
            target_bvid = arguments.get("bvid") or bvid
            return await _exec_video_detail(db, target_bvid)
        elif name == "get_sample_comments":
            return await _exec_sample_comments(db, query_id, bvid, arguments)
        elif name == "list_queries":
            return await _exec_list_queries(db)
        elif name == "execute_sql":
            return await _exec_sql_query(db, arguments)
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


async def _exec_stats_summary(db: AsyncSession, query_id: int | None) -> str:
    query = await db.get(Query, query_id)
    if not query:
        return json.dumps({"error": "Query not found"})
    return json.dumps({
        "video_count": query.video_count,
        "total_views": query.total_views, "total_likes": query.total_likes,
        "total_coins": query.total_coins, "total_favorites": query.total_favorites,
        "total_shares": query.total_shares, "total_danmaku": query.total_danmaku,
        "total_comments": query.total_comments,
    })


async def _get_latest_stats(db: AsyncSession, query_id: int) -> dict[str, tuple]:
    """Get latest VideoStats per video in query. Returns {bvid: (Video, VideoStats)}."""
    result = await db.execute(
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    latest: dict[str, tuple] = {}
    for video, stats in result.all():
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid][1].fetched_at:
            latest[video.bvid] = (video, stats)
    return latest


async def _exec_list_query_videos(db: AsyncSession, query_id: int | None) -> str:
    if not query_id:
        return json.dumps({"error": "No query context"})
    latest = await _get_latest_stats(db, query_id)
    if not latest:
        return json.dumps([])

    items = []
    for video, stats in latest.values():
        items.append({
            "bvid": video.bvid, "title": video.title,
            "published_at": video.published_at.isoformat() if video.published_at else None,
            "duration": video.duration,
            "views": stats.views, "likes": stats.likes, "coins": stats.coins,
            "favorites": stats.favorites, "shares": stats.shares,
            "danmaku_count": stats.danmaku_count, "comment_count": stats.comment_count,
        })
    items.sort(key=lambda x: x["published_at"] or "", reverse=True)
    return json.dumps(items, ensure_ascii=False)


async def _exec_views_trend(db: AsyncSession, query_id: int | None) -> str:
    latest = await _get_latest_stats(db, query_id)
    if not latest:
        return json.dumps([])

    dates = [v.published_at for v, _ in latest.values() if v.published_at]
    if not dates:
        return json.dumps([])

    min_d, max_d = min(dates), max(dates)
    span = (max_d - min_d).days
    if span <= 31:
        fmt = "%Y-%m-%d"
    elif span <= 180:
        fmt = "week"
    else:
        fmt = "%Y-%m"

    bucket: dict[str, int] = defaultdict(int)
    for video, stats in latest.values():
        if video.published_at:
            if fmt == "week":
                iso = video.published_at.isocalendar()
                key = f"{iso[0]}-W{iso[1]:02d}"
            else:
                key = video.published_at.strftime(fmt)
            bucket[key] += stats.views

    return json.dumps([{"date": k, "views": v} for k, v in sorted(bucket.items())])


async def _exec_top_videos(db: AsyncSession, query_id: int | None, args: dict) -> str:
    sort_by = args.get("sort_by", "views")
    order = args.get("order", "desc")
    limit = min(args.get("limit", 5), 20)

    latest = await _get_latest_stats(db, query_id)
    if not latest:
        return json.dumps([])

    items = []
    for video, stats in latest.values():
        items.append({
            "bvid": video.bvid, "title": video.title, "tags": video.tags,
            "views": stats.views, "likes": stats.likes, "coins": stats.coins,
            "favorites": stats.favorites, "shares": stats.shares,
            "danmaku_count": stats.danmaku_count, "comment_count": stats.comment_count,
        })

    reverse = order == "desc"
    items.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)
    return json.dumps(items[:limit])


async def _exec_video_comparison(db: AsyncSession, query_id: int | None, bvid: str | None) -> str:
    if not bvid:
        return json.dumps({"error": "No video context (bvid) provided"})
    if not query_id:
        return json.dumps({"error": "No query context provided for comparison"})

    stats_result = await db.execute(
        select(VideoStats).where(VideoStats.bvid == bvid).order_by(VideoStats.fetched_at.desc()).limit(1)
    )
    video_stats = stats_result.scalar_one_or_none()
    if not video_stats:
        return json.dumps({"error": "Video stats not found"})

    latest = await _get_latest_stats(db, query_id)
    count = len(latest) or 1
    metrics = ["views", "likes", "coins", "favorites", "shares", "danmaku_count", "comment_count"]
    labels = ["views", "likes", "coins", "favorites", "shares", "danmaku", "comments"]

    video_vals = [getattr(video_stats, m) for m in metrics]
    avg_vals = [sum(getattr(s, m) for _, s in latest.values()) / count for m in metrics]

    result = {}
    for label, vv, av in zip(labels, video_vals, avg_vals):
        pct = round((vv - av) / av * 100, 1) if av > 0 else 0
        result[label] = {"video": vv, "average": round(av, 1), "diff_pct": pct}

    return json.dumps(result)


async def _exec_demographics(db: AsyncSession, query_id: int | None, bvid: str | None) -> str:
    from app.services.wordcloud_svc import compute_user_demographics, compute_location_frequencies

    if bvid:
        result = await db.execute(select(VideoContent).where(VideoContent.bvid == bvid))
        content = result.scalar_one_or_none()
        items = normalize_items(_safe_json_loads(content.comments)) if content and content.comments else []
    elif query_id:
        result = await db.execute(
            select(VideoContent)
            .join(QueryVideo, QueryVideo.bvid == VideoContent.bvid)
            .where(QueryVideo.query_id == query_id)
        )
        items = []
        for content in result.scalars().all():
            if content.comments:
                items.extend(normalize_items(_safe_json_loads(content.comments)))
    else:
        return json.dumps({"error": "No context"})

    demographics = compute_user_demographics(items)
    demographics["location_distribution"] = compute_location_frequencies(items)
    return json.dumps(demographics)


async def _exec_word_frequencies(db: AsyncSession, query_id: int | None, bvid: str | None, args: dict) -> str:
    source = args.get("source", "title")

    if bvid:
        video = await db.get(Video, bvid)
        result = await db.execute(select(VideoContent).where(VideoContent.bvid == bvid))
        content = result.scalar_one_or_none()
        texts = _gather_texts_single(video, content, source)
    elif query_id:
        result = await db.execute(
            select(Video, VideoContent)
            .join(QueryVideo, QueryVideo.bvid == Video.bvid)
            .outerjoin(VideoContent, VideoContent.bvid == Video.bvid)
            .where(QueryVideo.query_id == query_id)
        )
        texts = []
        for video, content in result.all():
            texts.extend(_gather_texts_single(video, content, source))
    else:
        return json.dumps({"error": "No context"})

    if source == "tag":
        words = compute_tag_frequencies(texts)
    else:
        words = compute_word_frequencies(texts)
    return json.dumps(words[:50])


def _gather_texts_single(video, content, source: str) -> list[str]:
    """Gather text list from a video by source type."""
    texts = []
    if source == "title" and video:
        texts.append(video.title or "")
    elif source == "tag" and video:
        texts.extend((video.tags or "").split(","))
    elif source == "subtitle" and content and content.subtitle:
        texts.append(content.subtitle)
    elif source == "danmaku" and content and content.danmakus:
        texts.extend(_extract_texts(_safe_json_loads(content.danmakus)))
    elif source == "comment" and content and content.comments:
        texts.extend(_extract_texts(_safe_json_loads(content.comments)))
    return texts


async def _exec_sentiment_overview(db: AsyncSession, query_id: int | None, bvid: str | None) -> str:
    from app.services.sentiment_svc import compute_sentiment_distribution

    if bvid:
        result = await db.execute(
            select(VideoSentiment).where(VideoSentiment.bvid == bvid)
        )
        sentiment = result.scalar_one_or_none()
        if not sentiment:
            return json.dumps({"status": "not_analyzed"})
        details = _safe_json_loads(sentiment.details) if sentiment.details else []
        return json.dumps({
            "danmaku": compute_sentiment_distribution(details, "danmaku"),
            "comment": compute_sentiment_distribution(details, "comment"),
        })
    elif query_id:
        result = await db.execute(
            select(VideoSentiment)
            .join(QueryVideo, QueryVideo.bvid == VideoSentiment.bvid)
            .where(QueryVideo.query_id == query_id)
        )
        all_details = []
        for s in result.scalars().all():
            if s.details:
                all_details.extend(_safe_json_loads(s.details))
        if not all_details:
            return json.dumps({"status": "not_analyzed"})
        return json.dumps({
            "danmaku": compute_sentiment_distribution(all_details, "danmaku"),
            "comment": compute_sentiment_distribution(all_details, "comment"),
        })
    return json.dumps({"error": "No context"})


async def _exec_video_detail(db: AsyncSession, bvid: str | None) -> str:
    if not bvid:
        return json.dumps({"error": "No bvid provided"})

    video = await db.get(Video, bvid)
    if not video:
        return json.dumps({"error": f"Video {bvid} not found"})

    stats_result = await db.execute(
        select(VideoStats).where(VideoStats.bvid == bvid).order_by(VideoStats.fetched_at.desc()).limit(1)
    )
    stats = stats_result.scalar_one_or_none()

    data = {
        "bvid": video.bvid, "title": video.title,
        "description": video.description, "tags": video.tags,
        "duration": video.duration,
        "published_at": video.published_at.isoformat() if video.published_at else None,
    }
    if stats:
        data.update({
            "views": stats.views, "likes": stats.likes, "coins": stats.coins,
            "favorites": stats.favorites, "shares": stats.shares,
            "danmaku_count": stats.danmaku_count, "comment_count": stats.comment_count,
        })
    return json.dumps(data, ensure_ascii=False)


async def _exec_sample_comments(
    db: AsyncSession, query_id: int | None, bvid_ctx: str | None, args: dict,
) -> str:
    source = args.get("source", "comment")
    target_bvid = args.get("bvid") or bvid_ctx
    limit = min(args.get("limit", 20), 50)
    sort_by = args.get("sort_by", "likes")

    # Gather VideoContent rows
    if target_bvid:
        result = await db.execute(select(VideoContent).where(VideoContent.bvid == target_bvid))
        contents = [(target_bvid, result.scalar_one_or_none())]
    elif query_id:
        result = await db.execute(
            select(VideoContent)
            .join(QueryVideo, QueryVideo.bvid == VideoContent.bvid)
            .where(QueryVideo.query_id == query_id)
        )
        contents = [(c.bvid, c) for c in result.scalars().all()]
    else:
        return json.dumps({"error": "No context"})

    if source == "comment":
        all_comments = []
        for bvid, content in contents:
            if not content or not content.comments:
                continue
            for item in _safe_json_loads(content.comments):
                if isinstance(item, dict) and item.get("text"):
                    all_comments.append({
                        "text": item["text"],
                        "user": item.get("user", ""),
                        "likes": item.get("likes", 0),
                        "reply_count": item.get("reply_count", 0),
                        "up_liked": item.get("up_liked", False),
                        "up_replied": item.get("up_replied", False),
                        "bvid": bvid,
                    })
        if sort_by == "likes":
            all_comments.sort(key=lambda x: x.get("likes", 0), reverse=True)
        # "newest" keeps original order (already chronological from API)
        return json.dumps(all_comments[:limit], ensure_ascii=False)

    elif source == "danmaku":
        all_danmaku = []
        for bvid, content in contents:
            if not content or not content.danmakus:
                continue
            for item in _safe_json_loads(content.danmakus):
                text = item if isinstance(item, str) else (item.get("text", "") if isinstance(item, dict) else "")
                if text:
                    all_danmaku.append({"text": text, "bvid": bvid})
        if len(all_danmaku) > limit:
            all_danmaku = random.sample(all_danmaku, limit)
        return json.dumps(all_danmaku, ensure_ascii=False)

    return json.dumps({"error": f"Unknown source: {source}"})


async def _exec_list_queries(db: AsyncSession) -> str:
    result = await db.execute(
        select(Query).where(Query.status == "done").order_by(Query.created_at.desc())
    )
    queries = result.scalars().all()
    data = []
    for q in queries:
        data.append({
            "id": q.id, "uid": q.uid, "user_name": q.user_name,
            "start_date": q.start_date.isoformat() if q.start_date else None,
            "end_date": q.end_date.isoformat() if q.end_date else None,
            "video_count": q.video_count,
            "total_views": q.total_views, "total_likes": q.total_likes,
            "total_coins": q.total_coins, "total_favorites": q.total_favorites,
            "total_shares": q.total_shares, "total_danmaku": q.total_danmaku,
            "total_comments": q.total_comments,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        })
    return json.dumps(data, ensure_ascii=False)


async def _exec_sql_query(db: AsyncSession, args: dict) -> str:
    sql = (args.get("sql") or "").strip()
    if not sql:
        return json.dumps({"error": "No SQL query provided"})

    # Safety: only allow SELECT statements
    upper = sql.upper().lstrip()
    if not upper.startswith("SELECT"):
        return json.dumps({"error": "Only SELECT queries are allowed"})

    # Block dangerous patterns
    for keyword in ("INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE", "ATTACH", "DETACH"):
        if keyword in upper:
            return json.dumps({"error": f"Forbidden keyword: {keyword}"})

    from sqlalchemy import text

    try:
        result = await db.execute(text(sql))
        columns = list(result.keys())
        rows = result.fetchmany(200)
        data = [dict(zip(columns, row)) for row in rows]
        return json.dumps(data, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": f"SQL error: {str(e)}"})
