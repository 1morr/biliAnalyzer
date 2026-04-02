import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video, VideoSentiment
from app.schemas.sentiment import (
    SentimentOverview, SentimentDistribution, SentimentTrendPoint,
    SentimentWordItem, DemographicSentimentCell,
    SentimentContextResponse,
)
from app.services.sentiment_svc import (
    compute_sentiment_distribution, compute_sentiment_trend,
    compute_sentiment_word_cloud, compute_demographic_sentiment_matrix,
    filter_sentiment_contexts, _safe_json_loads,
)
from app.services.sentiment_task import run_sentiment_analysis

router = APIRouter()


# --- Helpers ---

async def _get_query_or_404(db: AsyncSession, query_id: int) -> Query:
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404)
    return query


async def _get_query_sentiments(db: AsyncSession, query_id: int) -> list:
    """Return list of (Video, VideoSentiment) for a query."""
    result = await db.execute(
        select(Video, VideoSentiment)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoSentiment, VideoSentiment.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    return result.all()


async def _get_video_sentiment(db: AsyncSession, bvid: str) -> VideoSentiment | None:
    result = await db.execute(
        select(VideoSentiment).where(VideoSentiment.bvid == bvid)
    )
    return result.scalar_one_or_none()


def _collect_details(sentiments: list) -> list[dict]:
    """Collect all detail items from multiple VideoSentiment records."""
    all_details = []
    for _, sentiment in sentiments:
        all_details.extend(_safe_json_loads(sentiment.details))
    return all_details


# --- Query-level endpoints ---

@router.get("/queries/{query_id}/sentiment/overview", response_model=SentimentOverview)
async def query_sentiment_overview(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await _get_query_or_404(db, query_id)

    if query.sentiment_status != "done":
        return SentimentOverview(status=query.sentiment_status)

    sentiments = await _get_query_sentiments(db, query_id)
    if not sentiments:
        return SentimentOverview(status="done")

    all_details = _collect_details(sentiments)
    danmaku_dist = compute_sentiment_distribution(all_details, "danmaku")
    comment_dist = compute_sentiment_distribution(all_details, "comment")

    return SentimentOverview(
        status="done",
        danmaku=SentimentDistribution(**danmaku_dist),
        comment=SentimentDistribution(**comment_dist),
    )


@router.get("/queries/{query_id}/sentiment/trend", response_model=list[SentimentTrendPoint])
async def query_sentiment_trend(query_id: int, db: AsyncSession = Depends(get_db)):
    await _get_query_or_404(db, query_id)
    sentiments = await _get_query_sentiments(db, query_id)
    points = compute_sentiment_trend(sentiments)
    return [SentimentTrendPoint(**p) for p in points]


@router.get("/queries/{query_id}/sentiment/wordcloud/{source}", response_model=list[SentimentWordItem])
async def query_sentiment_wordcloud(
    query_id: int, source: str,
    limit: int = QueryParam(100),
    db: AsyncSession = Depends(get_db),
):
    if source not in ("danmaku", "comment"):
        raise HTTPException(status_code=400, detail="source must be 'danmaku' or 'comment'")
    await _get_query_or_404(db, query_id)
    sentiments = await _get_query_sentiments(db, query_id)
    all_details = _collect_details(sentiments)
    words = compute_sentiment_word_cloud(all_details, source, limit)
    return [SentimentWordItem(**w) for w in words]


@router.get("/queries/{query_id}/sentiment/demographics", response_model=list[DemographicSentimentCell])
async def query_sentiment_demographics(query_id: int, db: AsyncSession = Depends(get_db)):
    await _get_query_or_404(db, query_id)
    sentiments = await _get_query_sentiments(db, query_id)
    all_details = _collect_details(sentiments)
    cells = compute_demographic_sentiment_matrix(all_details)
    return [DemographicSentimentCell(**c) for c in cells]


@router.get("/queries/{query_id}/sentiment/contexts", response_model=SentimentContextResponse)
async def query_sentiment_contexts(
    query_id: int,
    word: str | None = QueryParam(None),
    source: str | None = QueryParam(None),
    label: str | None = QueryParam(None),
    dimension: str | None = QueryParam(None),
    category: str | None = QueryParam(None),
    limit: int = QueryParam(50),
    db: AsyncSession = Depends(get_db),
):
    await _get_query_or_404(db, query_id)
    sentiments = await _get_query_sentiments(db, query_id)
    all_details = _collect_details(sentiments)
    result = filter_sentiment_contexts(
        all_details, word=word, source=source, label=label,
        dimension=dimension, category=category, limit=limit,
    )
    return SentimentContextResponse(**result)


# --- Video-level endpoints ---

@router.get("/videos/{bvid}/sentiment/overview", response_model=SentimentOverview)
async def video_sentiment_overview(bvid: str, db: AsyncSession = Depends(get_db)):
    sentiment = await _get_video_sentiment(db, bvid)
    if not sentiment:
        return SentimentOverview(status=None)

    details = _safe_json_loads(sentiment.details)
    danmaku_dist = compute_sentiment_distribution(details, "danmaku")
    comment_dist = compute_sentiment_distribution(details, "comment")

    return SentimentOverview(
        status="done",
        danmaku=SentimentDistribution(**danmaku_dist),
        comment=SentimentDistribution(**comment_dist),
    )


@router.get("/videos/{bvid}/sentiment/wordcloud/{source}", response_model=list[SentimentWordItem])
async def video_sentiment_wordcloud(
    bvid: str, source: str,
    limit: int = QueryParam(100),
    db: AsyncSession = Depends(get_db),
):
    if source not in ("danmaku", "comment"):
        raise HTTPException(status_code=400, detail="source must be 'danmaku' or 'comment'")
    sentiment = await _get_video_sentiment(db, bvid)
    if not sentiment:
        raise HTTPException(status_code=404, detail="No sentiment data")
    details = _safe_json_loads(sentiment.details)
    words = compute_sentiment_word_cloud(details, source, limit)
    return [SentimentWordItem(**w) for w in words]


@router.get("/videos/{bvid}/sentiment/demographics", response_model=list[DemographicSentimentCell])
async def video_sentiment_demographics(bvid: str, db: AsyncSession = Depends(get_db)):
    sentiment = await _get_video_sentiment(db, bvid)
    if not sentiment:
        raise HTTPException(status_code=404, detail="No sentiment data")
    details = _safe_json_loads(sentiment.details)
    cells = compute_demographic_sentiment_matrix(details)
    return [DemographicSentimentCell(**c) for c in cells]


@router.get("/videos/{bvid}/sentiment/contexts", response_model=SentimentContextResponse)
async def video_sentiment_contexts(
    bvid: str,
    word: str | None = QueryParam(None),
    source: str | None = QueryParam(None),
    label: str | None = QueryParam(None),
    dimension: str | None = QueryParam(None),
    category: str | None = QueryParam(None),
    limit: int = QueryParam(50),
    db: AsyncSession = Depends(get_db),
):
    sentiment = await _get_video_sentiment(db, bvid)
    if not sentiment:
        raise HTTPException(status_code=404, detail="No sentiment data")
    details = _safe_json_loads(sentiment.details)
    result = filter_sentiment_contexts(
        details, word=word, source=source, label=label,
        dimension=dimension, category=category, limit=limit,
    )
    return SentimentContextResponse(**result)


# --- Manual trigger ---

@router.post("/queries/{query_id}/sentiment/analyze")
async def trigger_sentiment_analysis(
    query_id: int,
    force: bool = QueryParam(False),
    db: AsyncSession = Depends(get_db),
):
    query = await _get_query_or_404(db, query_id)

    if query.status != "done":
        raise HTTPException(status_code=400, detail="Query must be done before sentiment analysis")

    if query.sentiment_status == "analyzing":
        return {"status": "analyzing", "message": "Already in progress"}

    asyncio.create_task(run_sentiment_analysis(query_id, force=force))
    return {"status": "started", "message": "Sentiment analysis started"}
