# backend/app/services/bilibili.py
import asyncio
import hashlib
import logging
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
        self._user_name_cache: dict[int, str] = {}
        self._semaphore = asyncio.Semaphore(1)  # rate limit: 1 concurrent request
        self._last_request_time: float = 0
        cookies = {
            "buvid3": f"{uuid.uuid4()}infoc",
            "b_nut": str(int(time.time())),
        }
        if sessdata:
            cookies["SESSDATA"] = sessdata
        self._client = httpx.AsyncClient(
            headers=HEADERS, cookies=cookies, timeout=30,
        )

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
        """Ensure at least 1.5 seconds between requests."""
        async with self._semaphore:
            now = time.time()
            wait = max(0, 1.5 - (now - self._last_request_time))
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_time = time.time()

    async def _request(self, url: str, params: dict | None = None, wbi: bool = False) -> dict:
        await self._ensure_fingerprint()
        raw_params = params
        max_retries = 3
        for attempt in range(max_retries):
            await self._throttle()
            if wbi:
                if not self._img_key or time.time() - self._wbi_keys_ts > self._WBI_KEY_TTL:
                    await self._refresh_wbi_keys()
                params = self._sign_wbi(raw_params or {})
            resp = await self._client.get(url, params=params)
            # Retry with refreshed keys on 412
            if resp.status_code == 412 and wbi:
                await self._refresh_wbi_keys()
                params = self._sign_wbi(raw_params or {})
                await self._throttle()
                resp = await self._client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            # Retry on rate limit (-799)
            if data.get("code") == -799 and attempt < max_retries - 1:
                delay = 3 * (attempt + 1)
                logger.warning("Rate limited (-799), retrying in %ds (attempt %d/%d)", delay, attempt + 1, max_retries)
                await asyncio.sleep(delay)
                continue
            return data
        return data  # return last response if all retries exhausted

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

    async def get_user_info(self, uid: int) -> dict:
        data = await self._request(
            f"{self.BASE}/x/space/acc/info",
            params={"mid": uid},
        )
        if data.get("code") != 0:
            raise Exception(f"Bilibili API error {data.get('code')}: {data.get('message')}")
        info = data["data"]
        self._user_name_cache[uid] = info["name"]
        return {"uid": uid, "name": info["name"], "avatar_url": info["face"]}

    async def get_video_list(self, uid: int, page: int = 1, page_size: int = 50) -> dict:
        # Primary: try WBI-signed endpoint
        try:
            data = await self._request(
                f"{self.BASE}/x/space/wbi/arc/search",
                params={"mid": uid, "ps": page_size, "pn": page, "order": "pubdate"},
                wbi=True,
            )
            if data.get("code") == 0:
                vlist = data["data"]["list"]["vlist"]
                total = data["data"]["page"]["count"]
                return {"videos": vlist, "total": total, "page": page}
            logger.info("WBI arc/search returned code %s, falling back to search API", data.get("code"))
        except Exception as e:
            logger.info("WBI arc/search failed (%s), falling back to search API", e)
        return await self._video_list_via_search(uid, page, page_size)

    async def _video_list_via_search(self, uid: int, page: int, page_size: int) -> dict:
        """Fallback: get video list using the search API + mid filter.

        The search API returns results from ALL users matching the keyword,
        so we search multiple pages to collect enough videos from the target uid.
        """
        # Get user name (from cache or API)
        name = self._user_name_cache.get(uid)
        if not name:
            user_info = await self._request(
                f"{self.BASE}/x/space/acc/info", params={"mid": uid}
            )
            name = user_info.get("data", {}).get("name", "")
            if name:
                self._user_name_cache[uid] = name
        if not name:
            raise Exception("Cannot resolve user name for search fallback")
        # Get total count
        nav = await self._request(
            f"{self.BASE}/x/space/navnum", params={"mid": uid}
        )
        total = nav.get("data", {}).get("video", 0)
        # Search across multiple pages, collecting only this user's videos
        # We need to skip (page-1)*page_size matching videos, then return page_size
        target_skip = (page - 1) * page_size
        collected = []
        skipped = 0
        for search_page in range(1, 51):  # search up to 50 pages
            data = await self._request(
                f"{self.BASE}/x/web-interface/search/type",
                params={
                    "search_type": "video",
                    "keyword": name,
                    "page": search_page,
                    "page_size": 50,
                    "order": "pubdate",
                },
            )
            results = data.get("data", {}).get("result") or []
            if not results:
                break
            for r in results:
                if r.get("mid") != uid:
                    continue
                if skipped < target_skip:
                    skipped += 1
                    continue
                collected.append({
                    "bvid": r.get("bvid", ""),
                    "title": r.get("title", "").replace('<em class="keyword">', "").replace("</em>", ""),
                    "created": r.get("pubdate", 0),
                })
                if len(collected) >= page_size:
                    return {"videos": collected, "total": total, "page": page}
        return {"videos": collected, "total": total, "page": page}

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
        subtitle_list = d.get("subtitle", {}).get("list") or []
        has_subtitle = len(subtitle_list) > 0
        return {
            "bvid": d["bvid"], "aid": d["aid"], "cid": d["cid"],
            "page_cids": page_cids,
            "has_subtitle": has_subtitle,
            "title": d["title"], "description": d.get("desc", ""),
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
                {"text": r["content"]["message"], "user": r.get("member", {}).get("uname", "")}
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
