import asyncio
import json
import logging
from datetime import datetime, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session
from app.models import Query, QueryVideo, VideoContent, VideoSentiment
from app.services.sentiment import get_analyzer
from app.services.wordcloud_svc import normalize_items

logger = logging.getLogger(__name__)


def _safe_json_loads(raw: str) -> list:
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _compute_aggregates(results: list[dict]) -> dict:
    """Compute avg_score and label percentages from a list of result dicts."""
    if not results:
        return {"avg_score": 0.0, "positive_pct": 0.0, "neutral_pct": 0.0, "negative_pct": 0.0, "count": 0}

    total = len(results)
    avg_score = sum(r["score"] for r in results) / total
    positive = sum(1 for r in results if r["label"] == "positive")
    neutral = sum(1 for r in results if r["label"] == "neutral")
    negative = sum(1 for r in results if r["label"] == "negative")

    return {
        "avg_score": round(avg_score, 4),
        "positive_pct": round(positive / total * 100, 1),
        "neutral_pct": round(neutral / total * 100, 1),
        "negative_pct": round(negative / total * 100, 1),
        "count": total,
    }


def _analyze_items(items: list[dict], source: str, analyzer) -> list[dict]:
    """Run sentiment analysis on normalized items, returning detail dicts."""
    texts = [item.get("text", "") for item in items]
    if not texts:
        return []

    results = analyzer.analyze_batch(texts)
    details = []
    for item, result in zip(items, results):
        details.append({
            "text": result.text,
            "score": result.score,
            "label": result.label,
            "confidence": result.confidence,
            "source": source,
            "user": item.get("user"),
            "uid": item.get("uid"),
            "location": item.get("location"),
            "user_level": item.get("user_level"),
            "user_sex": item.get("user_sex"),
            "vip_status": item.get("vip_status"),
            "vip_type": item.get("vip_type"),
        })
    return details


async def run_sentiment_analysis(query_id: int, force: bool = False):
    """Background task: run sentiment analysis for all videos in a query."""
    async with async_session() as db:
        query = await db.get(Query, query_id)
        if not query:
            return

        if query.sentiment_status == "done" and not force:
            return

        try:
            query.sentiment_status = "analyzing"
            await db.commit()

            analyzer = get_analyzer("snownlp")

            # Get all videos in this query
            result = await db.execute(
                select(QueryVideo.bvid).where(QueryVideo.query_id == query_id)
            )
            bvids = [row[0] for row in result.all()]

            if not bvids:
                query.sentiment_status = "done"
                await db.commit()
                return

            total = len(bvids)
            for i, bvid in enumerate(bvids, 1):
                query.progress = f"Analyzing sentiment {i}/{total}"
                await db.commit()

                # Skip if already analyzed (unless force)
                if not force:
                    existing = (await db.execute(
                        select(VideoSentiment).where(
                            VideoSentiment.bvid == bvid,
                            VideoSentiment.analyzer == analyzer.name,
                        )
                    )).scalar_one_or_none()
                    if existing:
                        continue

                # Delete old results for this video+analyzer if re-analyzing
                await db.execute(
                    delete(VideoSentiment).where(
                        VideoSentiment.bvid == bvid,
                        VideoSentiment.analyzer == analyzer.name,
                    )
                )

                content = (await db.execute(
                    select(VideoContent).where(VideoContent.bvid == bvid)
                )).scalar_one_or_none()

                if not content:
                    continue

                # Normalize and analyze danmakus
                danmaku_items = normalize_items(_safe_json_loads(content.danmakus)) if content.danmakus else []
                comment_items = normalize_items(_safe_json_loads(content.comments)) if content.comments else []

                loop = asyncio.get_event_loop()
                danmaku_details = await loop.run_in_executor(
                    None, _analyze_items, danmaku_items, "danmaku", analyzer
                )
                comment_details = await loop.run_in_executor(
                    None, _analyze_items, comment_items, "comment", analyzer
                )

                danmaku_agg = _compute_aggregates(danmaku_details)
                comment_agg = _compute_aggregates(comment_details)

                all_details = danmaku_details + comment_details

                sentiment = VideoSentiment(
                    bvid=bvid,
                    analyzer=analyzer.name,
                    danmaku_avg_score=danmaku_agg["avg_score"],
                    danmaku_positive_pct=danmaku_agg["positive_pct"],
                    danmaku_neutral_pct=danmaku_agg["neutral_pct"],
                    danmaku_negative_pct=danmaku_agg["negative_pct"],
                    danmaku_count=danmaku_agg["count"],
                    comment_avg_score=comment_agg["avg_score"],
                    comment_positive_pct=comment_agg["positive_pct"],
                    comment_neutral_pct=comment_agg["neutral_pct"],
                    comment_negative_pct=comment_agg["negative_pct"],
                    comment_count=comment_agg["count"],
                    details=json.dumps(all_details, ensure_ascii=False),
                    analyzed_at=datetime.now(timezone.utc),
                )
                db.add(sentiment)
                await db.commit()

            query.sentiment_status = "done"
            query.progress = None
            await db.commit()

        except Exception as e:
            logger.exception("Sentiment analysis failed for query %s: %s", query_id, e)
            query.sentiment_status = "error"
            await db.commit()
