# backend/app/services/bilibili.py
import asyncio
import hashlib
import time
import urllib.parse
from xml.etree import ElementTree

import httpx

# Standard WBI mixin key permutation table
MIXIN_KEY_ENC_TAB = [
    46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,
    33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,
    61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,
    36,20,34,44,52
]

class BilibiliClient:
    BASE = "https://api.bilibili.com"

    def __init__(self, sessdata: str | None = None):
        self._sessdata = sessdata
        self._img_key: str | None = None
        self._sub_key: str | None = None
        self._semaphore = asyncio.Semaphore(1)  # rate limit: 1 concurrent request
        self._last_request_time: float = 0

    def _get_mixin_key(self, orig: str) -> str:
        return "".join(orig[i] for i in MIXIN_KEY_ENC_TAB)[:32]

    def _sign_wbi(self, params: dict) -> dict:
        mixin_key = self._get_mixin_key(self._img_key + self._sub_key)
        params = dict(sorted({**params, "wts": int(time.time())}.items()))
        query = urllib.parse.urlencode(params)
        w_rid = hashlib.md5((query + mixin_key).encode()).hexdigest()
        params["w_rid"] = w_rid
        return params

    async def _throttle(self):
        """Ensure at least 1 second between requests."""
        async with self._semaphore:
            now = time.time()
            wait = max(0, 1.0 - (now - self._last_request_time))
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_time = time.time()

    def _get_cookies(self) -> dict:
        if self._sessdata:
            return {"SESSDATA": self._sessdata}
        return {}

    async def _request(self, url: str, params: dict | None = None, wbi: bool = False) -> dict:
        await self._throttle()
        if wbi:
            if not self._img_key:
                await self._refresh_wbi_keys()
            params = self._sign_wbi(params or {})
        async with httpx.AsyncClient(cookies=self._get_cookies(), timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def _refresh_wbi_keys(self):
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.BASE}/x/web-interface/nav")
            data = resp.json()["data"]
        img_url = data["wbi_img"]["img_url"]
        sub_url = data["wbi_img"]["sub_url"]
        self._img_key = img_url.rsplit("/", 1)[1].split(".")[0]
        self._sub_key = sub_url.rsplit("/", 1)[1].split(".")[0]

    # --- Public API methods ---

    async def get_user_info(self, uid: int) -> dict:
        data = await self._request(
            f"{self.BASE}/x/space/wbi/acc/info",
            params={"mid": uid}, wbi=True
        )
        info = data["data"]
        return {"uid": uid, "name": info["name"], "avatar_url": info["face"]}

    async def get_video_list(self, uid: int, page: int = 1, page_size: int = 50) -> dict:
        data = await self._request(
            f"{self.BASE}/x/space/wbi/arc/search",
            params={"mid": uid, "ps": page_size, "pn": page, "order": "pubdate"},
            wbi=True
        )
        vlist = data["data"]["list"]["vlist"]
        total = data["data"]["page"]["count"]
        return {"videos": vlist, "total": total, "page": page}

    async def get_video_detail(self, bvid: str) -> dict:
        data = await self._request(f"{self.BASE}/x/web-interface/view", params={"bvid": bvid})
        d = data["data"]
        stat = d["stat"]
        tags_str = ""
        if "tag" in d:
            tags_str = ",".join(t["tag_name"] for t in d.get("tag", []))
        return {
            "bvid": d["bvid"], "aid": d["aid"], "cid": d["cid"],
            "title": d["title"], "description": d.get("desc", ""),
            "cover_url": d["pic"], "duration": d["duration"],
            "published_at": d["pubdate"],  # unix timestamp
            "tags": tags_str,
            "stats": {
                "views": stat["view"], "likes": stat["like"], "coins": stat["coin"],
                "favorites": stat["favorite"], "shares": stat["share"],
                "danmaku_count": stat["danmaku"], "comment_count": stat["reply"],
            }
        }

    async def get_comments(self, aid: int, max_pages: int = 5) -> list[str]:
        comments = []
        for page in range(1, max_pages + 1):
            data = await self._request(
                f"{self.BASE}/x/v2/reply",
                params={"type": 1, "oid": aid, "pn": page, "sort": 1}
            )
            replies = data.get("data", {}).get("replies") or []
            if not replies:
                break
            comments.extend(r["content"]["message"] for r in replies)
        return comments

    async def get_danmakus(self, cid: int) -> list[str]:
        if not self._sessdata:
            return []
        await self._throttle()
        async with httpx.AsyncClient(cookies=self._get_cookies(), timeout=30) as client:
            resp = await client.get(f"https://comment.bilibili.com/{cid}.xml")
            resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)
        return [d.text for d in root.findall(".//d") if d.text]

    async def get_subtitle(self, bvid: str, cid: int) -> str:
        if not self._sessdata:
            return ""
        data = await self._request(
            f"{self.BASE}/x/player/v2",
            params={"bvid": bvid, "cid": cid}
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
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(subtitle_url)
            resp.raise_for_status()
            sub_data = resp.json()
        return " ".join(item["content"] for item in sub_data.get("body", []))
