# backend/app/services/wordcloud_svc.py
import re
from collections import Counter
import jieba

# Common Chinese stop words (single characters iterated from string + multi-char words)
STOP_WORDS = set("的了是在不有和人这中大为上个国我以要他时来用们生到作地于出会可也你对就里如被从之好最所然机与说本长看那但下自现前工么都很种多将学实手世美行无才同得当已先过身什而做家所开意把让面公关新等能没理事全体想电民接正")
STOP_WORDS.update({"知道", "我们", "可以", "这个", "什么", "没有", "就是", "一个", "不是", "因为", "所以", "如果", "已经", "还是"})
STOP_WORDS.update({"", " ", "\n", "\t", "哈哈", "啊", "了", "的", "是", "s", "c"})


def normalize_items(raw_items: list) -> list[dict]:
    """Convert mixed format items to [{"text": str, "user": str|None, "location": str|None}].

    Handles both old format (plain strings) and new format (dicts with text/user/location).
    """
    result = []
    for item in raw_items:
        if isinstance(item, str):
            result.append({"text": item, "user": None, "location": None})
        elif isinstance(item, dict):
            result.append({
                "text": item.get("text", ""),
                "user": item.get("user") or None,
                "location": item.get("location") or None
            })
    return result


def compute_word_frequencies(texts: list[str], limit: int = 100) -> list[dict]:
    """Tokenize texts with jieba, count word frequencies, return top N."""
    combined = " ".join(texts)
    if not combined.strip():
        return []

    words = jieba.cut(combined)
    filtered = [w for w in words if len(w) > 1 and w not in STOP_WORDS]

    if not filtered:
        return []

    counter = Counter(filtered)
    return [{"name": word, "value": count} for word, count in counter.most_common(limit)]


def compute_tag_frequencies(tags: list[str], limit: int = 100) -> list[dict]:
    """Count tag frequencies directly (no jieba tokenization)."""
    cleaned = [t.strip() for t in tags if t.strip()]
    if not cleaned:
        return []
    counter = Counter(cleaned)
    return [{"name": tag, "value": count} for tag, count in counter.most_common(limit)]


def compute_user_frequencies(items: list[dict], limit: int = 100) -> list[dict]:
    """Count user frequencies from normalized items [{"text", "user"}, ...]."""
    users = [item["user"] for item in items if item.get("user")]
    if not users:
        return []
    counter = Counter(users)
    return [{"name": user, "value": count} for user, count in counter.most_common(limit)]


def compute_location_frequencies(items: list[dict], limit: int = 100) -> list[dict]:
    """Count location frequencies from normalized items [{"text", "user", "location"}, ...]."""
    locations = [item["location"] for item in items if item.get("location")]
    if not locations:
        return []
    # Remove "IP属地：" prefix if present
    cleaned_locations = [loc.replace("IP属地：", "").strip() for loc in locations]
    counter = Counter(cleaned_locations)
    return [{"name": location, "value": count} for location, count in counter.most_common(limit)]


def extract_word_contexts(
    texts: list[tuple],
    word: str,
    max_snippets: int = 10,
) -> list[dict]:
    """Extract context snippets for a word from annotated texts.

    Args:
        texts: list of (bvid, title, raw_text, user, source) tuples.
               user and source can be None.
        word: the target word to find contexts for
        max_snippets: max total snippets to return across all videos

    Returns:
        list of {"bvid", "title", "count", "snippets"} dicts grouped by video.
        Each snippet is {"text": str, "user": str|None, "source": str|None}.
    """
    results: dict[str, dict] = {}
    total_snippets = 0

    for entry in texts:
        bvid, title, raw_text = entry[0], entry[1], entry[2]
        user = entry[3] if len(entry) > 3 else None
        source = entry[4] if len(entry) > 4 else None

        if not raw_text:
            continue

        # Count occurrences of the word in segmented text
        segmented = list(jieba.cut(raw_text))
        count = sum(1 for w in segmented if w == word)
        if count == 0:
            continue

        # Extract surrounding context snippets from the raw text
        snippets: list[dict] = []
        if total_snippets < max_snippets:
            for match in re.finditer(re.escape(word), raw_text):
                if total_snippets >= max_snippets:
                    break
                start = max(0, match.start() - 20)
                end = min(len(raw_text), match.end() + 20)
                snippet_text = raw_text[start:end].strip()
                if start > 0:
                    snippet_text = "..." + snippet_text
                if end < len(raw_text):
                    snippet_text = snippet_text + "..."
                snippets.append({"text": snippet_text, "user": user, "source": source})
                total_snippets += 1

        if bvid in results:
            results[bvid]["count"] += count
            results[bvid]["snippets"].extend(snippets)
        else:
            results[bvid] = {
                "bvid": bvid,
                "title": title,
                "count": count,
                "snippets": snippets,
            }

    return sorted(results.values(), key=lambda x: x["count"], reverse=True)


def extract_user_comments(
    texts: list[tuple],
    username: str,
    max_snippets: int = 20,
) -> list[dict]:
    """Extract all comments by a specific user.

    Args:
        texts: list of (bvid, title, raw_text, user, source) tuples
        username: the target username
        max_snippets: max total snippets

    Returns:
        list of {"bvid", "title", "count", "snippets"} dicts grouped by video
    """
    results: dict[str, dict] = {}
    total_snippets = 0

    for entry in texts:
        bvid, title, raw_text = entry[0], entry[1], entry[2]
        user = entry[3] if len(entry) > 3 else None
        source = entry[4] if len(entry) > 4 else None

        if user != username or not raw_text:
            continue

        if bvid not in results:
            results[bvid] = {"bvid": bvid, "title": title, "count": 0, "snippets": []}

        results[bvid]["count"] += 1
        if total_snippets < max_snippets:
            text = raw_text if len(raw_text) <= 80 else raw_text[:80] + "..."
            results[bvid]["snippets"].append({"text": text, "user": user, "source": source})
            total_snippets += 1

    return sorted(results.values(), key=lambda x: x["count"], reverse=True)


def extract_location_comments(
    texts: list[tuple],
    location: str,
    max_snippets: int = 20,
) -> list[dict]:
    """Extract all comments from a specific location.

    Args:
        texts: list of (bvid, title, raw_text, user, source, location) tuples
        location: the target location (without "IP属地：" prefix)
        max_snippets: max total snippets

    Returns:
        list of {"bvid", "title", "count", "snippets"} dicts grouped by video
    """
    results: dict[str, dict] = {}
    total_snippets = 0

    for entry in texts:
        bvid, title, raw_text = entry[0], entry[1], entry[2]
        user = entry[3] if len(entry) > 3 else None
        source = entry[4] if len(entry) > 4 else None
        loc = entry[5] if len(entry) > 5 else None

        # Clean location by removing "IP属地：" prefix
        if loc:
            loc = loc.replace("IP属地：", "").strip()

        if loc != location or not raw_text:
            continue

        if bvid not in results:
            results[bvid] = {"bvid": bvid, "title": title, "count": 0, "snippets": []}

        results[bvid]["count"] += 1
        if total_snippets < max_snippets:
            text = raw_text if len(raw_text) <= 80 else raw_text[:80] + "..."
            results[bvid]["snippets"].append({"text": text, "user": user, "source": source})
            total_snippets += 1

    return sorted(results.values(), key=lambda x: x["count"], reverse=True)
