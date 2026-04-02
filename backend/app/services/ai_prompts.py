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
        "Perform a comprehensive analysis of this channel's data.\n\n"
        "## Steps\n"
        "1. Call `list_query_videos` to get all videos and understand the content landscape.\n"
        "2. Call `get_stats_summary` + `get_views_trend` for aggregate metrics and trends.\n"
        "3. Call `get_top_videos` to identify top and underperforming videos.\n"
        "4. Call `get_demographics_summary` to understand the audience profile.\n"
        "5. Call `get_sentiment_overview` for danmaku and comment sentiment.\n"
        "6. Call `get_sample_comments(source=\"comment\", limit=15)` to sample top comments.\n\n"
        "## Output Format\n"
        "Use the following structure with `##` headings:\n\n"
        "### Channel Overview\n"
        "One paragraph summarizing the channel's positioning, content direction, and data scale (video count, total views, date range).\n\n"
        "### Key Metrics\n"
        "A markdown table of aggregate metrics (views, likes, coins, favorites, danmaku, comments) with per-video averages.\n\n"
        "### Content Performance\n"
        "- A markdown table of Top 5 and Bottom 3 videos (title, views, likes, coins).\n"
        "- Analyze common traits of high and low performers (topic, duration, publish timing, etc.).\n\n"
        "### Publish Trends\n"
        "Describe how views change over time; note peaks and valleys and what content drove them.\n\n"
        "### Audience Profile\n"
        "Summarize key demographic traits: gender, membership level, geographic distribution.\n\n"
        "### Audience Feedback\n"
        "- Summarize the danmaku/comment sentiment distribution.\n"
        "- Quote 3-5 representative comments verbatim using `>` blockquote format.\n\n"
        "### Insights & Recommendations\n"
        "Provide 3-5 specific, actionable recommendations, each citing supporting data."
    ),
    "topic_inspiration": (
        "Suggest new video topic ideas based on this channel's data.\n\n"
        "## Steps\n"
        "1. Call `list_query_videos` to understand existing content coverage.\n"
        "2. Call `get_top_videos(sort_by=\"views\", limit=10)` to find the best-performing content.\n"
        "3. Call `get_word_frequencies(source=\"title\")` + `get_word_frequencies(source=\"tag\")` to extract recurring themes.\n"
        "4. Call `get_sample_comments(source=\"comment\", sort_by=\"likes\", limit=20)` to discover audience interests.\n"
        "5. Call `get_sample_comments(source=\"danmaku\", limit=30)` to capture real-time audience reactions.\n\n"
        "## Output Format\n"
        "Use the following structure:\n\n"
        "### Current Content Analysis\n"
        "Briefly summarize the channel's content direction, frequent themes, and best-performing content types.\n\n"
        "### Audience Demand Insights\n"
        "Extract audience interests and unmet needs from comments and danmaku. Quote 2-3 comments using `>` blockquote format as evidence.\n\n"
        "### Topic Recommendations\n"
        "Present 5-8 topic ideas in a markdown table:\n"
        "| Topic Direction | Suggested Title Example | Data Basis | Reasoning |\n"
        "The \"Data Basis\" column should cite specific metrics (e.g., similar videos average XX views).\n\n"
        "### Pitfalls to Avoid\n"
        "Based on traits of low-performing videos, list 2-3 directions to avoid."
    ),
    "video_analysis": (
        "Perform a detailed analysis of this video.\n\n"
        "## Steps\n"
        "1. Call `get_video_detail` to get full video information.\n"
        "2. Call `get_video_comparison` to compare against the channel average.\n"
        "3. Call `get_sentiment_overview` for this video's sentiment distribution.\n"
        "4. Call `get_word_frequencies(source=\"danmaku\")` + `get_word_frequencies(source=\"comment\")` for keyword analysis.\n"
        "5. Call `get_sample_comments(source=\"comment\", sort_by=\"likes\", limit=15)` to sample top comments.\n"
        "6. Call `get_sample_comments(source=\"danmaku\", limit=20)` to sample danmaku.\n\n"
        "## Output Format\n"
        "Use the following structure:\n\n"
        "### Video Info\n"
        "Title, publish date, duration, and tags in a concise list.\n\n"
        "### Performance Metrics\n"
        "A markdown table comparing this video vs. channel averages:\n"
        "| Metric | This Video | Channel Avg | Difference |\n"
        "Highlight metrics significantly above or below the average.\n\n"
        "### Audience Feedback\n"
        "- Sentiment breakdown: positive/neutral/negative percentages for danmaku and comments.\n"
        "- Top 10 frequent danmaku keywords.\n"
        "- Quote 3-5 representative comments using `>` blockquote format, covering both positive and negative.\n\n"
        "### Strengths & Weaknesses\n"
        "List what the video does well and where it falls short, each point backed by data.\n\n"
        "### Improvement Suggestions\n"
        "Provide 2-3 targeted suggestions for improving the next similar video."
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
