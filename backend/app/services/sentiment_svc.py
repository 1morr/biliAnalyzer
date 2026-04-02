import json
from collections import Counter, defaultdict
import jieba
from app.services.wordcloud_svc import (
    STOP_WORDS, _normalize_gender, _normalize_level, _normalize_vip, _normalize_location,
)


def _safe_json_loads(raw: str | None) -> list:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def compute_sentiment_distribution(details: list[dict], source: str | None = None) -> dict:
    """Compute distribution stats from detail items, optionally filtered by source."""
    items = [d for d in details if source is None or d.get("source") == source]
    if not items:
        return {"avg_score": 0.0, "positive_pct": 0.0, "neutral_pct": 0.0, "negative_pct": 0.0, "count": 0}

    total = len(items)
    avg_score = sum(d["score"] for d in items) / total
    pos = sum(1 for d in items if d["label"] == "positive")
    neu = sum(1 for d in items if d["label"] == "neutral")
    neg = sum(1 for d in items if d["label"] == "negative")

    return {
        "avg_score": round(avg_score, 4),
        "positive_pct": round(pos / total * 100, 1),
        "neutral_pct": round(neu / total * 100, 1),
        "negative_pct": round(neg / total * 100, 1),
        "count": total,
    }


def compute_sentiment_trend(video_sentiments: list) -> list[dict]:
    """Aggregate sentiment by video publish date for trend visualization.

    Args:
        video_sentiments: list of (Video, VideoSentiment) tuples
    """
    if not video_sentiments:
        return []

    dates = [v.published_at for v, _ in video_sentiments if v.published_at]
    if not dates:
        return []

    min_date, max_date = min(dates), max(dates)
    span_days = (max_date - min_date).days

    if span_days <= 31:
        fmt = "%Y-%m-%d"
    elif span_days <= 180:
        fmt = "week"
    else:
        fmt = "%Y-%m"

    buckets: dict[str, dict] = defaultdict(lambda: {
        "danmaku_scores": [], "comment_scores": [],
        "danmaku_pos": 0, "danmaku_total": 0,
        "comment_pos": 0, "comment_total": 0,
    })

    for video, sentiment in video_sentiments:
        if not video.published_at:
            continue
        if fmt == "week":
            iso = video.published_at.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        else:
            key = video.published_at.strftime(fmt)

        b = buckets[key]
        if sentiment.danmaku_count > 0:
            b["danmaku_scores"].append(sentiment.danmaku_avg_score)
            b["danmaku_pos"] += sentiment.danmaku_positive_pct * sentiment.danmaku_count / 100
            b["danmaku_total"] += sentiment.danmaku_count
        if sentiment.comment_count > 0:
            b["comment_scores"].append(sentiment.comment_avg_score)
            b["comment_pos"] += sentiment.comment_positive_pct * sentiment.comment_count / 100
            b["comment_total"] += sentiment.comment_count

    result = []
    for date_key in sorted(buckets.keys()):
        b = buckets[date_key]
        point = {"date": date_key}
        if b["danmaku_scores"]:
            point["danmaku_avg"] = round(sum(b["danmaku_scores"]) / len(b["danmaku_scores"]), 4)
            point["danmaku_positive_pct"] = round(b["danmaku_pos"] / b["danmaku_total"] * 100, 1) if b["danmaku_total"] else 0
        if b["comment_scores"]:
            point["comment_avg"] = round(sum(b["comment_scores"]) / len(b["comment_scores"]), 4)
            point["comment_positive_pct"] = round(b["comment_pos"] / b["comment_total"] * 100, 1) if b["comment_total"] else 0
        result.append(point)

    return result


def compute_sentiment_word_cloud(details: list[dict], source: str, limit: int = 100) -> list[dict]:
    """Word frequency + average sentiment score per word.

    Uses jieba tokenization and STOP_WORDS, same as wordcloud_svc.
    """
    items = [d for d in details if d.get("source") == source]
    if not items:
        return []

    word_scores: dict[str, list[float]] = defaultdict(list)
    word_count: Counter = Counter()

    for item in items:
        text = item.get("text", "")
        score = item.get("score", 0.5)
        if not text.strip():
            continue
        words = jieba.cut(text)
        for w in words:
            if len(w) > 1 and w not in STOP_WORDS:
                word_count[w] += 1
                word_scores[w].append(score)

    result = []
    for word, count in word_count.most_common(limit):
        scores = word_scores[word]
        avg = sum(scores) / len(scores)
        if avg >= 0.6:
            label = "positive"
        elif avg <= 0.4:
            label = "negative"
        else:
            label = "neutral"
        result.append({"name": word, "value": count, "avg_score": round(avg, 4), "label": label})

    return result


def filter_sentiment_contexts(
    details: list[dict],
    word: str | None = None,
    source: str | None = None,
    label: str | None = None,
    dimension: str | None = None,
    category: str | None = None,
    limit: int = 50,
) -> dict:
    """Filter detail items by various criteria and return matching contexts."""
    items = details

    if source:
        items = [d for d in items if d.get("source") == source]
    if label:
        items = [d for d in items if d.get("label") == label]
    if word:
        items = [d for d in items if word in d.get("text", "")]

    if dimension and category:
        normalizers = {
            "gender": lambda d: _normalize_gender(d.get("user_sex")),
            "level": lambda d: _normalize_level(d.get("user_level")),
            "vip": lambda d: _normalize_vip(d.get("vip_status"), d.get("vip_type")),
            "location": lambda d: _normalize_location(d.get("location")) or "未知",
        }
        norm = normalizers.get(dimension)
        if norm:
            items = [d for d in items if norm(d) == category]

    total_count = len(items)
    items = items[:limit]

    return {
        "total_count": total_count,
        "items": [
            {
                "text": d.get("text", ""),
                "user": d.get("user"),
                "score": d.get("score", 0),
                "label": d.get("label", "neutral"),
                "source": d.get("source"),
            }
            for d in items
        ],
    }


def compute_demographic_sentiment_matrix(details: list[dict]) -> list[dict]:
    """Cross-analyze sentiment by demographic dimensions.

    Only uses comment entries (danmaku has no demographic metadata).
    """
    # Filter to comments only — danmaku has no user demographic data
    comment_details = [d for d in details if d.get("source") == "comment"]
    if not comment_details:
        return []

    dimensions = {
        "gender": lambda d: _normalize_gender(d.get("user_sex")),
        "level": lambda d: _normalize_level(d.get("user_level")),
        "vip": lambda d: _normalize_vip(d.get("vip_status"), d.get("vip_type")),
        "location": lambda d: _normalize_location(d.get("location")) or "未知",
    }

    result = []
    for dim_name, get_category in dimensions.items():
        groups: dict[str, list[dict]] = defaultdict(list)
        for d in comment_details:
            cat = get_category(d)
            groups[cat].append(d)

        for category, items in groups.items():
            if not items:
                continue
            total = len(items)
            avg_score = sum(d["score"] for d in items) / total
            pos = sum(1 for d in items if d["label"] == "positive")
            neu = sum(1 for d in items if d["label"] == "neutral")
            neg = sum(1 for d in items if d["label"] == "negative")

            result.append({
                "dimension": dim_name,
                "category": category,
                "avg_score": round(avg_score, 4),
                "positive_pct": round(pos / total * 100, 1),
                "neutral_pct": round(neu / total * 100, 1),
                "negative_pct": round(neg / total * 100, 1),
                "count": total,
            })

    return result
