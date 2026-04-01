# backend/app/services/wordcloud_svc.py
import re
from collections import Counter
import jieba

# Common Chinese stop words (single characters iterated from string + multi-char words)
STOP_WORDS = set("的了是在不有和人这中大为上个国我以要他时来用们生到作地于出会可也你对就里如被从之好最所然机与说本长看那但下自现前工么都很种多将学实手世美行无才同得当已先过身什而做家所开意把让面公关新等能没理事全体想电民接正")
STOP_WORDS.update({"知道", "我们", "可以", "这个", "什么", "没有", "就是", "一个", "不是", "因为", "所以", "如果", "已经", "还是"})
STOP_WORDS.update({"", " ", "\n", "\t", "哈哈", "啊", "了", "的", "是", "s", "c"})


def normalize_items(raw_items: list) -> list[dict]:
    """Convert mixed format items to normalized dicts.

    Handles both old format (plain strings) and new format (dicts with text/user/location
    and optional comment demographic fields).
    """
    result = []
    for item in raw_items:
        if isinstance(item, str):
            result.append({
                "text": item,
                "uid": None,
                "user": None,
                "location": None,
                "user_level": None,
                "user_sex": None,
                "vip_status": None,
                "vip_type": None,
                "official_verify_type": None,
            })
        elif isinstance(item, dict):
            result.append({
                "text": item.get("text", ""),
                "uid": item.get("uid"),
                "user": item.get("user") or None,
                "location": item.get("location") or None,
                "user_level": item.get("user_level"),
                "user_sex": item.get("user_sex") or None,
                "vip_status": item.get("vip_status"),
                "vip_type": item.get("vip_type"),
                "official_verify_type": item.get("official_verify_type"),
            })
    return result


def _normalize_username(user: str | None) -> str | None:
    if not user:
        return None
    normalized = user.strip()
    return normalized or None


def _identity_key_from(uid, user: str | None) -> tuple[str | None, str | None]:
    if uid not in (None, ""):
        return f"uid:{uid}", "uid"
    username = _normalize_username(user)
    if username:
        return f"name:{username}", "name"
    return None, None


def _identity_key(item: dict) -> tuple[str | None, str | None]:
    return _identity_key_from(item.get("uid"), item.get("user"))


_VALID_GENDERS = {"男", "女", "保密"}


def _normalize_gender(value: str | None) -> str:
    return value if value in _VALID_GENDERS else "未知"


def _normalize_level(value) -> str:
    if isinstance(value, int) and 0 <= value <= 6:
        return f"LV{value}"
    return "未知"


def _normalize_vip(vip_status, vip_type) -> str:
    if vip_status in (None, ""):
        return "未知"
    if vip_status != 1:
        return "非大会员"
    if vip_type == 2:
        return "年度大会员"
    return "月度大会员"


def _prefer_value(current, incoming):
    if current not in (None, "", "未知"):
        return current
    return incoming


def _merge_identity_record(target: dict, source: dict):
    target["gender"] = _prefer_value(target.get("gender"), source.get("gender"))
    target["level"] = _prefer_value(target.get("level"), source.get("level"))
    target["vip"] = _prefer_value(target.get("vip"), source.get("vip"))
    target["identity_source"] = "uid" if target.get("identity_source") == "uid" or source.get("identity_source") == "uid" else "name"
    target["username"] = target.get("username") or source.get("username")


def _counter_to_distribution(counter: Counter[str], order: list[str]) -> list[dict]:
    result = []
    seen: set[str] = set()
    for name in order:
        seen.add(name)
        if counter.get(name, 0) > 0:
            result.append({"name": name, "value": counter[name]})
    for name, value in counter.items():
        if name not in seen and value > 0:
            result.append({"name": name, "value": value})
    return result


def compute_user_demographics(items: list[dict]) -> dict:
    """Aggregate deduplicated comment-user demographics.

    Dedupes by uid when available, otherwise falls back to username.
    """
    identities: dict[str, dict] = {}
    username_to_uid_identity: dict[str, str] = {}
    ambiguous_usernames: set[str] = set()

    for item in items:
        username = _normalize_username(item.get("user"))
        uid = item.get("uid")
        key, source = _identity_key(item)
        if not key:
            continue

        if uid not in (None, ""):
            key = f"uid:{uid}"
            if username and username not in ambiguous_usernames:
                fallback_key = f"name:{username}"
                if fallback_key in identities and fallback_key != key:
                    fallback_record = identities.pop(fallback_key)
                    existing_record = identities.get(key)
                    if existing_record is None:
                        identities[key] = fallback_record
                        existing_record = fallback_record
                    else:
                        _merge_identity_record(existing_record, fallback_record)
                    existing_record["identity_source"] = "uid"

                mapped_uid_key = username_to_uid_identity.get(username)
                if mapped_uid_key and mapped_uid_key != key:
                    username_to_uid_identity.pop(username, None)
                    ambiguous_usernames.add(username)
                elif username not in ambiguous_usernames:
                    username_to_uid_identity[username] = key
        elif username:
            if username in ambiguous_usernames:
                key = f"name:{username}"
            else:
                key = username_to_uid_identity.get(username, key)

        record = identities.get(key)
        if record is None:
            record = {
                "gender": "未知",
                "level": "未知",
                "vip": "未知",
                "identity_source": source,
                "username": username,
            }
            identities[key] = record

        record["gender"] = _prefer_value(record.get("gender"), _normalize_gender(item.get("user_sex")))
        record["level"] = _prefer_value(record.get("level"), _normalize_level(item.get("user_level")))
        record["vip"] = _prefer_value(record.get("vip"), _normalize_vip(item.get("vip_status"), item.get("vip_type")))
        if uid not in (None, ""):
            record["identity_source"] = "uid"
        if username:
            record["username"] = username

    gender_counter = Counter(record["gender"] for record in identities.values())
    level_counter = Counter(record["level"] for record in identities.values())
    vip_counter = Counter(record["vip"] for record in identities.values())
    uid_backed_users = sum(1 for record in identities.values() if record.get("identity_source") == "uid")
    username_fallback_users = sum(1 for record in identities.values() if record.get("identity_source") == "name")

    return {
        "total_unique_users": len(identities),
        "uid_backed_users": uid_backed_users,
        "username_fallback_users": username_fallback_users,
        "gender_ratio": _counter_to_distribution(gender_counter, ["男", "女", "保密", "未知"]),
        "level_distribution": _counter_to_distribution(level_counter, ["LV0", "LV1", "LV2", "LV3", "LV4", "LV5", "LV6", "未知"]),
        "vip_ratio": _counter_to_distribution(vip_counter, ["非大会员", "月度大会员", "年度大会员", "未知"]),
    }


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
    """Count comment frequencies per unique user identity (uid-first, username fallback)."""
    identity_names: dict[str, str] = {}  # identity_key -> display username
    counter: Counter[str] = Counter()

    for item in items:
        identity_key, _ = _identity_key(item)
        if not identity_key:
            continue
        username = _normalize_username(item.get("user"))
        if username:
            identity_names[identity_key] = username
        counter[identity_key] += 1

    if not counter:
        return []

    return [
        {"name": identity_names.get(key, key), "value": count}
        for key, count in counter.most_common(limit)
    ]


def _normalize_location(location: str | None) -> str | None:
    """Normalize location strings for aggregation and matching."""
    if not location:
        return None
    normalized = location.replace("IP属地：", "").strip()
    return normalized or None


def compute_location_frequencies(items: list[dict], limit: int = 100) -> list[dict]:
    """Count unique-user location frequencies from normalized items."""
    seen_identities: set[tuple[str, str]] = set()
    counter: Counter[str] = Counter()
    for item in items:
        identity_key, _ = _identity_key(item)
        location = _normalize_location(item.get("location"))
        if not identity_key or not location:
            continue
        identity_location = (identity_key, location)
        if identity_location in seen_identities:
            continue
        seen_identities.add(identity_location)
        counter[location] += 1

    if not counter:
        return []

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
    """Extract all comments by a specific user (uid-first identity matching).

    First finds all identity keys associated with the given username,
    then collects all comments by any of those identities.

    Args:
        texts: list of (bvid, title, raw_text, user, source, location, uid) tuples
        username: the target username (display name from wordcloud click)
        max_snippets: max total snippets

    Returns:
        list of {"bvid", "title", "count", "snippets"} dicts grouped by video
    """
    # First pass: find all identity keys associated with this username
    target_identities: set[str] = set()
    for entry in texts:
        user = entry[3] if len(entry) > 3 else None
        uid = entry[6] if len(entry) > 6 else None
        if user == username:
            key, _ = _identity_key_from(uid, user)
            if key:
                target_identities.add(key)

    if not target_identities:
        return []

    # Second pass: collect all comments by any of those identities
    results: dict[str, dict] = {}
    total_snippets = 0

    for entry in texts:
        bvid, title, raw_text = entry[0], entry[1], entry[2]
        user = entry[3] if len(entry) > 3 else None
        source = entry[4] if len(entry) > 4 else None
        uid = entry[6] if len(entry) > 6 else None

        key, _ = _identity_key_from(uid, user)
        if not key or key not in target_identities or not raw_text:
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
    """Extract representative comments for unique users from a specific location."""
    location = _normalize_location(location)
    results: dict[str, dict] = {}
    total_snippets = 0
    seen_identities: set[str] = set()

    for entry in texts:
        bvid, title, raw_text = entry[0], entry[1], entry[2]
        user = entry[3] if len(entry) > 3 else None
        source = entry[4] if len(entry) > 4 else None
        loc = entry[5] if len(entry) > 5 else None
        uid = entry[6] if len(entry) > 6 else None

        loc = _normalize_location(loc)
        identity_key, _ = _identity_key_from(uid, user)

        if not identity_key or loc != location or not raw_text or identity_key in seen_identities:
            continue
        seen_identities.add(identity_key)

        if bvid not in results:
            results[bvid] = {"bvid": bvid, "title": title, "count": 0, "snippets": []}

        results[bvid]["count"] += 1
        if total_snippets < max_snippets:
            text = raw_text if len(raw_text) <= 80 else raw_text[:80] + "..."
            results[bvid]["snippets"].append({"text": text, "user": user, "source": source})
            total_snippets += 1

    return sorted(results.values(), key=lambda x: x["count"], reverse=True)
