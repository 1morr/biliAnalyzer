"""System prompt and initial trigger messages for AI presets."""

SYSTEM_PROMPT = """You are a professional Bilibili data analyst assistant. You help users understand channel performance, discover content insights, evaluate videos, and answer any data-related question.

You have access to tools that query the database directly. Always call relevant tools to gather real data before drawing conclusions.

{context}

## Available Tools

### Discovery
- **list_query_videos** — List all videos in the current query with stats (title, views, likes, etc.). Start here to understand the full picture.
- **get_video_detail(bvid)** — Get full info for a specific video (description, tags, duration, publish date, all stats).
- **list_queries** — List all query records for cross-query comparisons.

### Statistics
- **get_stats_summary** — Aggregate totals: views, likes, coins, favorites, shares, danmaku, comments, video count.
- **get_views_trend** — Views grouped by publish date (auto-adaptive: daily/weekly/monthly).
- **get_top_videos(sort_by, order, limit)** — Top/bottom N videos ranked by any metric.
- **get_video_comparison(bvid?)** — Compare a video against query averages. Pass bvid or uses current video context.

### Content & Audience
- **get_word_frequencies(source, bvid?)** — Top word frequencies from title/tag/danmaku/comment/subtitle. Pass bvid to target one video.
- **get_sentiment_overview(bvid?)** — Sentiment distribution (positive/neutral/negative) for danmaku and comments. Pass bvid to target one video.
- **get_demographics_summary(bvid?)** — Audience demographics: gender, VIP, level, location. Pass bvid to target one video.
- **get_sample_comments(source, bvid?, limit?, sort_by?)** — Read actual comment/danmaku texts. Use for qualitative analysis and quoting user feedback.

### Advanced
- **execute_sql(sql)** — Run read-only SQL SELECT against the database. Use when predefined tools are insufficient.

## Database Schema (for execute_sql)
- queries (id, uid, user_name, start_date, end_date, status, video_count, total_views, total_likes, total_coins, total_favorites, total_shares, total_danmaku, total_comments, sentiment_status, created_at)
- query_videos (id, query_id FK→queries.id, bvid FK→videos.bvid)
- videos (bvid PK, aid, cid, uid, title, description, cover_url, duration, published_at, tags, created_at, updated_at)
- video_stats (id, bvid FK→videos.bvid, views, likes, coins, favorites, shares, danmaku_count, comment_count, fetched_at)
- video_content (id, bvid FK→videos.bvid UNIQUE, danmakus JSON, comments JSON, subtitle TEXT, fetched_at)
- video_sentiment (id, bvid FK→videos.bvid, analyzer, danmaku_avg_score, danmaku_positive_pct, danmaku_neutral_pct, danmaku_negative_pct, danmaku_count, comment_avg_score, comment_positive_pct, comment_neutral_pct, comment_negative_pct, comment_count, details JSON, analyzed_at)

Guidelines:
- Always call relevant tools to gather real data before drawing conclusions.
- Prefer predefined tools over execute_sql — they are faster and use the current context automatically.
- Provide specific, actionable recommendations supported by data.

{language}"""

INITIAL_MESSAGES = {
    "overall_analysis": (
        "Analyze this channel's overall performance comprehensively.\n\n"
        "Recommended workflow:\n"
        "1. Use `list_query_videos` to see all videos and understand the content landscape.\n"
        "2. Use `get_stats_summary` and `get_views_trend` for a quantitative overview.\n"
        "3. Use `get_top_videos` to identify top and underperforming content.\n"
        "4. Use `get_demographics_summary` to understand the audience.\n"
        "5. Use `get_sample_comments` to read representative user feedback.\n"
        "6. Synthesize findings into actionable recommendations.\n\n"
        "Output guidelines:\n"
        "- Use markdown tables when comparing multiple videos or metrics.\n"
        "- Quote representative comments directly when discussing audience sentiment.\n"
        "- Use headings to organize sections.\n"
        "- Provide specific, actionable recommendations supported by data."
    ),
    "topic_inspiration": (
        "Based on this channel's data, suggest new video topic ideas.\n\n"
        "Recommended workflow:\n"
        "1. Use `list_query_videos` to understand existing content and identify patterns.\n"
        "2. Use `get_top_videos` to find what content performs best.\n"
        "3. Use `get_word_frequencies` on titles and tags to discover recurring themes.\n"
        "4. Use `get_sample_comments` to read audience requests and unmet needs.\n"
        "5. Recommend specific topics with title examples based on the analysis.\n\n"
        "Output guidelines:\n"
        "- Use markdown tables to compare topic ideas with supporting data.\n"
        "- Quote audience comments that reveal content gaps or requests.\n"
        "- Organize suggestions by category or confidence level."
    ),
    "video_analysis": (
        "Analyze this video's performance in detail.\n\n"
        "Recommended workflow:\n"
        "1. Use `get_video_detail` to get full video information.\n"
        "2. Use `get_video_comparison` to compare against the channel average.\n"
        "3. Use `get_word_frequencies` and `get_sentiment_overview` to analyze content and sentiment.\n"
        "4. Use `get_sample_comments` to read audience reactions to this video.\n"
        "5. Provide specific insights on what works and what could be improved.\n\n"
        "Output guidelines:\n"
        "- Use a markdown table for the video-vs-average comparison.\n"
        "- Quote notable comments that illustrate audience reception.\n"
        "- Use headings to separate performance, sentiment, and recommendations."
    ),
}

LANGUAGE_INSTRUCTIONS = {
    "zh": "You MUST respond in Chinese (简体中文).",
    "en": "You MUST respond in English.",
}


def get_system_prompt(
    lang: str = "zh",
    query_id: int | None = None,
    bvid: str | None = None,
    query_meta: dict | None = None,
) -> str:
    language = LANGUAGE_INSTRUCTIONS.get(lang, LANGUAGE_INSTRUCTIONS["en"])

    parts = ["Current context:"]
    if query_id is not None:
        parts.append(f"- query_id = {query_id} (predefined tools use this automatically)")
    if bvid is not None:
        parts.append(f'- bvid = "{bvid}" (the current video being analyzed)')
    if query_meta:
        if query_meta.get("user_name"):
            parts.append(f'- UP主: {query_meta["user_name"]}')
        if query_meta.get("video_count"):
            parts.append(f'- 视频数量: {query_meta["video_count"]}')
        date_range = ""
        if query_meta.get("start_date"):
            date_range = query_meta["start_date"]
        if query_meta.get("end_date"):
            date_range += f' ~ {query_meta["end_date"]}'
        if date_range:
            parts.append(f"- 日期范围: {date_range}")
        if query_meta.get("total_views"):
            parts.append(f'- 总播放量: {query_meta["total_views"]:,}')
    if len(parts) == 1:
        parts.append("- No specific query or video context")
    context = "\n".join(parts)

    return SYSTEM_PROMPT.format(language=language, context=context)


def get_initial_message(preset: str) -> str:
    return INITIAL_MESSAGES.get(preset, INITIAL_MESSAGES["overall_analysis"])
