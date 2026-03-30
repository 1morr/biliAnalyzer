# backend/app/services/ai_analysis.py
import json
from collections import Counter
from openai import AsyncOpenAI

SYSTEM_PROMPT_ZH = """你是一位专业的B站内容策略分析师。根据提供的频道数据，分析以下方面：

1. **最火内容分析**：哪些视频表现最好，有什么共同特征
2. **成功因素**：标题策略、标签策略、发布时间等关键因素
3. **可执行建议**：具体的、可操作的改进建议
4. **需要改进的地方**：数据中显示的弱点和改进空间

请用清晰的分段格式回答，使用 Markdown。"""

SYSTEM_PROMPT_EN = """You are a professional Bilibili content strategist. Based on the provided channel data, analyze:

1. **Top Performers**: Which videos performed best and what common traits they share
2. **Success Factors**: Key factors like title strategy, tags, posting time
3. **Actionable Recommendations**: Specific, actionable improvement suggestions
4. **Areas to Improve**: Weaknesses shown in the data

Respond in clear sections using Markdown."""


def build_analysis_prompt(videos_data: list[dict], summary: dict, lang: str = "zh") -> list[dict]:
    system = SYSTEM_PROMPT_ZH if lang == "zh" else SYSTEM_PROMPT_EN

    # Build data summary
    top_5 = sorted(videos_data, key=lambda v: v.get("views", 0), reverse=True)[:5]
    bottom_5 = sorted(videos_data, key=lambda v: v.get("views", 0))[:5]

    all_tags = []
    for v in videos_data:
        all_tags.extend(t.strip() for t in (v.get("tags") or "").split(",") if t.strip())
    tag_freq = Counter(all_tags).most_common(20)

    data_text = f"""## Channel Summary
- Total videos: {summary['video_count']}
- Total views: {summary['total_views']:,}
- Total likes: {summary['total_likes']:,}
- Total coins: {summary['total_coins']:,}
- Total favorites: {summary['total_favorites']:,}
- Avg views per video: {summary['total_views'] // max(summary['video_count'], 1):,}
- Avg interaction rate: {_avg_interaction(videos_data):.2f}%

## Top 5 Videos
{_format_videos(top_5)}

## Bottom 5 Videos
{_format_videos(bottom_5)}

## Top Tags
{', '.join(f'{t}({c})' for t, c in tag_freq)}

## All Videos
{_format_all_videos(videos_data)}
"""
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": data_text},
    ]


def _avg_interaction(videos: list[dict]) -> float:
    total_inter = sum(v.get("likes", 0) + v.get("coins", 0) + v.get("favorites", 0) + v.get("shares", 0) for v in videos)
    total_views = sum(v.get("views", 0) for v in videos)
    return (total_inter / total_views * 100) if total_views > 0 else 0


def _format_videos(videos: list[dict]) -> str:
    lines = []
    for v in videos:
        lines.append(f"- 「{v['title']}」 views={v.get('views', 0):,} likes={v.get('likes', 0):,} coins={v.get('coins', 0):,}")
    return "\n".join(lines)


def _format_all_videos(videos: list[dict]) -> str:
    lines = []
    for v in sorted(videos, key=lambda x: x.get("views", 0), reverse=True):
        rate = 0
        if v.get("views", 0) > 0:
            rate = (v.get("likes", 0) + v.get("coins", 0) + v.get("favorites", 0) + v.get("shares", 0)) / v["views"] * 100
        lines.append(f"- 「{v['title']}」 views={v.get('views', 0):,} rate={rate:.1f}% tags={v.get('tags', '')}")
    return "\n".join(lines)


async def stream_analysis(client: AsyncOpenAI, model: str, messages: list[dict]):
    """Yield text chunks from AI streaming response."""
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
