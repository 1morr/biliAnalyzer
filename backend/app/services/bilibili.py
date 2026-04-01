# backend/app/services/bilibili.py
import asyncio
import hashlib
import logging
import random
import re
import time
import urllib.parse
import uuid
from xml.etree import ElementTree

import httpx

logger = logging.getLogger(__name__)

# Standard WBI mixin key permutation table
MIXIN_KEY_ENC_TAB = [
    46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,
    33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,
    61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,
    36,20,34,44,52
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com",
    "Origin": "https://www.bilibili.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Sec-Fetch-Site": "same-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Sec-Ch-Ua-Platform": '"Windows"',
}


class BilibiliClient:
    BASE = "https://api.bilibili.com"
    _WBI_KEY_TTL = 600  # refresh WBI keys every 10 minutes

    def __init__(self, sessdata: str | None = None):
        self._sessdata = sessdata
        self._img_key: str | None = None
        self._sub_key: str | None = None
        self._wbi_keys_ts: float = 0
        self._fingerprint_ready = False
        self._semaphore = asyncio.Semaphore(1)  # rate limit: 1 concurrent request
        self._last_request_time: float = 0
        self._rate_limit_count: int = 0  # track -799 occurrences
        self._base_delay: float = 1.5  # base delay between requests
        cookies = {
            "buvid3": f"{uuid.uuid4()}infoc",
            "b_nut": str(int(time.time())),
        }
        if sessdata:
            cookies["SESSDATA"] = sessdata
        self._client = httpx.AsyncClient(
            headers=HEADERS, cookies=cookies, timeout=30,
        )

    async def aclose(self):
        client = getattr(self, "_client", None)
        if client is not None:
            await client.aclose()

    def _get_mixin_key(self, orig: str) -> str:
        return "".join(orig[i] for i in MIXIN_KEY_ENC_TAB)[:32]

    async def _ensure_fingerprint(self):
        """Upgrade buvid cookies with API-provided values (best-effort)."""
        if self._fingerprint_ready:
            return
        self._fingerprint_ready = True
        try:
            resp = await self._client.get(f"{self.BASE}/x/frontend/finger/spi")
            data = resp.json().get("data", {})
            b3 = data.get("b_3", "")
            b4 = data.get("b_4", "")
            if b3:
                self._client.cookies["buvid3"] = b3
            if b4:
                self._client.cookies["buvid4"] = b4
            logger.debug("Fingerprint cookies set: buvid3=%s, buvid4=%s", b3[:8], b4[:8] if b4 else "")
        except Exception as e:
            logger.debug("Failed to fetch fingerprint from API (using local): %s", e)

    @staticmethod
    def _sanitize(value: str) -> str:
        """Remove characters that break WBI signature verification."""
        for ch in "!'()*":
            value = value.replace(ch, "")
        return value

    def _sign_wbi(self, params: dict) -> dict:
        mixin_key = self._get_mixin_key(self._img_key + self._sub_key)
        params = {
            **params,
            "dm_img_list": "[]",
            "dm_img_str": "V2ViR0wgMS4w",
            "dm_cover_img_str": "QU5HTEUgKEludGVsLCBJbnRlbChSKSBVSEQgR3Jh",
            "wts": int(time.time()),
        }
        params = dict(sorted(params.items()))
        # Sanitize all values and convert to str before hashing
        sanitized = {k: self._sanitize(str(v)) for k, v in params.items()}
        query = urllib.parse.urlencode(sanitized)
        w_rid = hashlib.md5((query + mixin_key).encode()).hexdigest()
        sanitized["w_rid"] = w_rid
        return sanitized

    async def _throttle(self):
        """Ensure random delay between requests with dynamic adjustment."""
        async with self._semaphore:
            now = time.time()
            # Add random jitter: base_delay to base_delay*2.5
            jitter = random.uniform(self._base_delay, self._base_delay * 2.5)
            wait = max(0, jitter - (now - self._last_request_time))
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_time = time.time()

    async def _request(self, url: str, params: dict | None = None, wbi: bool = False) -> dict:
        await self._ensure_fingerprint()
        raw_params = params or {}
        max_retries = 3
        data: dict | None = None
        for attempt in range(max_retries):
            await self._throttle()
            request_params = raw_params
            if wbi:
                if not self._img_key or time.time() - self._wbi_keys_ts > self._WBI_KEY_TTL:
                    await self._refresh_wbi_keys()
                request_params = self._sign_wbi(raw_params)
            resp = await self._client.get(url, params=request_params)
            if resp.status_code == 412:
                if wbi:
                    await self._refresh_wbi_keys()
                if attempt < max_retries - 1:
                    delay = 1 + attempt * 2 + random.uniform(0, 0.5)
                    logger.warning(
                        "Received HTTP 412 from %s, retrying in %.1fs (attempt %d/%d)",
                        url, delay, attempt + 1, max_retries,
                    )
                    await asyncio.sleep(delay)
                    continue
            resp.raise_for_status()
            data = resp.json()
            # Retry on rate limit (-799) with exponential backoff
            if data.get("code") == -799:
                self._rate_limit_count += 1
                # Increase base delay if getting rate limited frequently
                if self._rate_limit_count >= 3:
                    self._base_delay = min(self._base_delay * 1.5, 5.0)
                    logger.warning("Frequent rate limits detected, increasing base delay to %.1fs", self._base_delay)
                if attempt < max_retries - 1:
                    # Exponential backoff with jitter: 3s, 9s, 27s
                    delay = (3 ** (attempt + 1)) + random.uniform(0, 2)
                    logger.warning("Rate limited (-799), retrying in %.1fs (attempt %d/%d)", delay, attempt + 1, max_retries)
                    await asyncio.sleep(delay)
                    continue
            else:
                # Reset rate limit counter on success
                if self._rate_limit_count > 0:
                    self._rate_limit_count = max(0, self._rate_limit_count - 1)
            return data
        if data is not None:
            return data
        raise Exception(f"Request to {url} exhausted retries without data")

    async def _refresh_wbi_keys(self):
        await self._ensure_fingerprint()
        resp = await self._client.get(f"{self.BASE}/x/web-interface/nav")
        data = resp.json()["data"]
        img_url = data["wbi_img"]["img_url"]
        sub_url = data["wbi_img"]["sub_url"]
        self._img_key = img_url.rsplit("/", 1)[1].split(".")[0]
        self._sub_key = sub_url.rsplit("/", 1)[1].split(".")[0]
        self._wbi_keys_ts = time.time()

    # --- Public API methods ---

    async def validate_sessdata(self) -> dict:
        if not self._sessdata:
            raise Exception("SESSDATA not configured")
        data = await self._request(f"{self.BASE}/x/web-interface/nav")
        if data.get("code") != 0:
            raise Exception(f"Bilibili API error {data.get('code')}: {data.get('message')}")
        nav = data.get("data") or {}
        if not nav.get("isLogin"):
            raise Exception("SESSDATA is invalid or expired")
        uname = nav.get("uname") or ""
        return {"uname": uname}

    async def get_user_info(self, uid: int) -> dict:
        # Primary: x/web-interface/card (less strict rate limiting)
        try:
            data = await self._request(
                f"{self.BASE}/x/web-interface/card",
                params={"mid": uid, "photo": "false"},
            )
            if data.get("code") == 0:
                card = data["data"]["card"]
                return {"uid": uid, "name": card["name"], "avatar_url": card["face"]}
            logger.info("card API returned code %s, falling back to acc/info", data.get("code"))
        except Exception as e:
            logger.info("card API failed (%s), falling back to acc/info", e)
        # Fallback: x/space/wbi/acc/info with WBI signing
        data = await self._request(
            f"{self.BASE}/x/space/wbi/acc/info",
            params={"mid": uid},
            wbi=True,
        )
        if data.get("code") != 0:
            raise Exception(f"Bilibili API error {data.get('code')}: {data.get('message')}")
        info = data["data"]
        return {"uid": uid, "name": info["name"], "avatar_url": info["face"]}

    def _normalize_video_stub(self, raw: dict, source: str) -> dict | None:
        bvid = raw.get("bvid") or ""
        if not bvid:
            return None
        title = raw.get("title", "")
        if isinstance(title, str):
            title = title.replace('<em class="keyword">', "").replace("</em>", "")
        published_ts = raw.get("pubdate") or raw.get("created") or raw.get("ctime") or 0
        published_ts = int(published_ts) if published_ts else 0
        video = {
            "bvid": bvid,
            "title": title,
            "published_ts": published_ts,
            "created": published_ts,
            "source": source,
        }
        ctime = raw.get("ctime")
        if ctime is not None:
            video["ctime"] = int(ctime)
        return video

    def _dedupe_video_stubs(self, videos: list[dict]) -> list[dict]:
        deduped: dict[str, dict] = {}
        for video in videos:
            if not video or not video.get("bvid"):
                continue
            bvid = video["bvid"]
            current = deduped.get(bvid)
            if current is None:
                deduped[bvid] = dict(video)
                continue
            merged = dict(current)
            for key, value in video.items():
                if key in {"published_ts", "created", "ctime"}:
                    continue
                if not merged.get(key) and value not in (None, ""):
                    merged[key] = value
            best_ts = max(
                int(current.get("published_ts", 0) or 0),
                int(video.get("published_ts", 0) or 0),
            )
            if best_ts:
                merged["published_ts"] = best_ts
                merged["created"] = best_ts
            if "ctime" in current or "ctime" in video:
                merged["ctime"] = max(
                    int(current.get("ctime", 0) or 0),
                    int(video.get("ctime", 0) or 0),
                )
            deduped[bvid] = merged
        return sorted(
            deduped.values(),
            key=lambda item: int(item.get("published_ts", 0) or 0),
            reverse=True,
        )

    def _slice_video_page(self, videos: list[dict], page: int, page_size: int) -> dict:
        page = max(page, 1)
        page_size = max(page_size, 1)
        start = (page - 1) * page_size
        end = start + page_size
        return {"videos": videos[start:end], "total": len(videos), "page": page}

    async def _get_expected_video_total(self, uid: int) -> int | None:
        try:
            nav = await self._request(f"{self.BASE}/x/space/navnum", params={"mid": uid})
            return int(nav.get("data", {}).get("video", 0) or 0)
        except Exception as e:
            logger.info("navnum lookup failed for uid %s (%s)", uid, e)
            return None

    def _rec_archives_full_looks_truncated(self, videos: list[dict], page_info: dict) -> bool:
        total = int(page_info.get("total", 0) or 0)
        size = int(page_info.get("size", 0) or 0)
        if total > 0 and not videos:
            return True
        return bool(total > len(videos) and len(videos) <= max(size, 1))

    def _is_complete_video_index(self, result: dict, video_count: int, expected_total: int | None) -> bool:
        result_total = int(result.get("total", 0) or 0)
        if result_total and video_count >= result_total:
            return True
        return bool(expected_total is not None and video_count >= expected_total)

    @staticmethod
    def _is_live_replay_text(text: str) -> bool:
        if not isinstance(text, str):
            return False
        return bool(re.match(r"^【直播回放】.+\d{4}年\d{2}月\d{2}日\d{2}点场$", text.strip()))

    def _is_live_replay_video(self, title: str, page_parts: list[str]) -> bool:
        if self._is_live_replay_text(title):
            return True
        return any(self._is_live_replay_text(part) for part in page_parts)

    def _filter_live_replay_stubs(self, videos: list[dict]) -> list[dict]:
        return [video for video in videos if not self._is_live_replay_text(video.get("title", ""))]

    async def get_video_index(self, uid: int) -> dict:
        expected_total = await self._get_expected_video_total(uid)
        result = await self._video_index_via_rec_archives_full(uid)
        videos = self._filter_live_replay_stubs(
            self._dedupe_video_stubs(result.get("videos") or [])
        )
        is_complete = self._is_complete_video_index(result, len(videos), expected_total)
        logger.info(
            "Video index fetched via rec_archives_full for uid %s: expected=%s unique=%d complete=%s",
            uid, expected_total, len(videos), is_complete,
        )
        return {
            "videos": videos,
            "total": len(videos),
            "expected_total": expected_total,
            "source": "rec_archives_full",
            "is_complete_snapshot": is_complete,
        }

    async def get_video_list(self, uid: int, page: int = 1, page_size: int = 50) -> dict:
        result = await self.get_video_index(uid)
        return self._slice_video_page(result["videos"], page, page_size)

    async def _video_index_via_rec_archives_full(self, uid: int) -> dict:
        attempts = [
            {"mid": uid, "keywords": "", "orderby": "senddate", "pn": 0},
            {"mid": uid, "keywords": "", "pn": 0},
        ]
        last_error: Exception | None = None
        for params in attempts:
            try:
                data = await self._request(
                    f"{self.BASE}/x/series/recArchivesByKeywords",
                    params=params,
                )
                if data.get("code") != 0:
                    raise Exception(f"Bilibili API error {data.get('code')}: {data.get('message')}")
                payload = data.get("data") or {}
                videos = [
                    video for item in (payload.get("archives") or [])
                    if (video := self._normalize_video_stub(item, "rec_archives_full"))
                ]
                if self._rec_archives_full_looks_truncated(videos, payload.get("page") or {}):
                    raise Exception("recArchivesByKeywords pn=0 returned a truncated page")
                return {"videos": videos, "is_complete_snapshot": True}
            except Exception as e:
                last_error = e
        if last_error:
            raise last_error
        raise Exception("recArchivesByKeywords pn=0 returned no usable data")

    async def get_video_detail(self, bvid: str) -> dict:
        data = await self._request(
            f"{self.BASE}/x/web-interface/view",
            params={"bvid": bvid},
        )
        if data.get("code") != 0:
            raise Exception(f"Bilibili API error {data.get('code')}: {data.get('message')}")
        d = data["data"]
        stat = d["stat"]
        # /view doesn't include Tags separately; try to get from honor_reply or tag endpoint
        tags_str = ""
        try:
            tag_data = await self._request(
                f"{self.BASE}/x/tag/archive/tags",
                params={"bvid": bvid},
            )
            if tag_data.get("code") == 0:
                tags = tag_data.get("data") or []
                tags_str = ",".join(t["tag_name"] for t in tags if "tag_name" in t)
        except Exception:
            pass
        pages = d.get("pages") or []
        page_cids = [{"page": p["page"], "cid": p["cid"], "part": p.get("part", "")} for p in pages]
        page_parts = [p.get("part", "") for p in pages]
        subtitle_list = d.get("subtitle", {}).get("list") or []
        has_subtitle = len(subtitle_list) > 0
        title = d["title"]
        return {
            "bvid": d["bvid"], "aid": d["aid"], "cid": d["cid"],
            "page_cids": page_cids,
            "has_subtitle": has_subtitle,
            "is_live_replay": self._is_live_replay_video(title, page_parts),
            "title": title, "description": d.get("desc", ""),
            "cover_url": d["pic"], "duration": d["duration"],
            "published_at": d["pubdate"],
            "tags": tags_str,
            "stats": {
                "views": stat["view"], "likes": stat["like"],
                "coins": stat["coin"], "favorites": stat["favorite"],
                "shares": stat["share"], "danmaku_count": stat["danmaku"],
                "comment_count": stat["reply"],
            },
        }

    async def get_comments(self, aid: int, max_pages: int = 5) -> list[dict]:
        comments = []
        for page in range(1, max_pages + 1):
            data = await self._request(
                f"{self.BASE}/x/v2/reply",
                params={"type": 1, "oid": aid, "pn": page, "sort": 1}
            )
            replies = data.get("data", {}).get("replies") or []
            if not replies:
                break
            comments.extend(
                {
                    "text": r["content"]["message"],
                    "user": r.get("member", {}).get("uname", ""),
                    "location": r.get("reply_control", {}).get("location", ""),
                    "user_level": r.get("member", {}).get("level_info", {}).get("current_level", 0),
                    "user_sex": r.get("member", {}).get("sex", "保密"),
                    "vip_status": r.get("member", {}).get("vip", {}).get("vipStatus", 0),
                    "vip_type": r.get("member", {}).get("vip", {}).get("vipType", 0),
                    "official_verify_type": r.get("member", {}).get("official_verify", {}).get("type", -1),
                    "like": r.get("like", 0),
                    "reply_count": r.get("rcount", 0),
                    "up_liked": r.get("up_action", {}).get("like", False),
                    "up_replied": r.get("up_action", {}).get("reply", False)
                }
                for r in replies
            )
        return comments

    async def get_danmakus(self, cid: int) -> list[str]:
        if not self._sessdata:
            return []
        await self._throttle()
        resp = await self._client.get(f"https://comment.bilibili.com/{cid}.xml")
        resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)
        return [d.text for d in root.findall(".//d") if d.text]

    async def get_subtitle(self, bvid: str, aid: int, cid: int) -> str:
        if not self._sessdata:
            return ""
        data = await self._request(
            f"{self.BASE}/x/player/wbi/v2",
            params={"aid": aid, "bvid": bvid, "cid": cid},
            wbi=True,
        )
        subtitles = data.get("data", {}).get("subtitle", {}).get("subtitles", [])
        if not subtitles:
            return ""
        subtitle_url = subtitles[0].get("subtitle_url", "")
        if not subtitle_url:
            return ""
        if subtitle_url.startswith("//"):
            subtitle_url = "https:" + subtitle_url
        await self._throttle()
        resp = await self._client.get(subtitle_url)
        resp.raise_for_status()
        sub_data = resp.json()
        return " ".join(item["content"] for item in sub_data.get("body", []))
