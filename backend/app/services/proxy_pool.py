import logging
import time
import uuid
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

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

FINGER_URL = "https://api.bilibili.com/x/frontend/finger/spi"
COOLDOWN_BASE = 30  # seconds
COOLDOWN_MAX = 300  # seconds


@dataclass
class ProxyEntry:
    url: str
    client: httpx.AsyncClient
    fingerprint_ready: bool = False
    consecutive_failures: int = 0
    skip_until: float = 0


class ProxyPool:
    def __init__(self, proxy_urls: list[str]):
        self._proxy_urls = proxy_urls
        self._entries: list[ProxyEntry] = []
        self._index = 0
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        self._initialized = True
        for url in self._proxy_urls:
            cookies = {
                "buvid3": f"{uuid.uuid4()}infoc",
                "b_nut": str(int(time.time())),
            }
            client = httpx.AsyncClient(
                proxy=url, headers=HEADERS, cookies=cookies, timeout=30,
            )
            self._entries.append(ProxyEntry(url=url, client=client))
        logger.info("Proxy pool initialized with %d proxies", len(self._entries))

    async def _ensure_fingerprint(self, entry: ProxyEntry):
        if entry.fingerprint_ready:
            return
        entry.fingerprint_ready = True
        try:
            resp = await entry.client.get(FINGER_URL)
            data = resp.json().get("data", {})
            b3 = data.get("b_3", "")
            b4 = data.get("b_4", "")
            if b3:
                entry.client.cookies["buvid3"] = b3
            if b4:
                entry.client.cookies["buvid4"] = b4
            logger.debug(
                "Proxy %s fingerprint set: buvid3=%s",
                entry.url, b3[:8] if b3 else "",
            )
        except Exception as e:
            logger.debug("Proxy %s fingerprint failed: %s", entry.url, e)

    async def get_client(self) -> tuple[httpx.AsyncClient, ProxyEntry] | None:
        if not self._entries:
            return None
        now = time.time()
        n = len(self._entries)
        for _ in range(n):
            entry = self._entries[self._index % n]
            self._index += 1
            if now < entry.skip_until:
                continue
            await self._ensure_fingerprint(entry)
            return entry.client, entry
        return None

    def report_success(self, entry: ProxyEntry):
        entry.consecutive_failures = 0
        entry.skip_until = 0

    def report_failure(self, entry: ProxyEntry):
        entry.consecutive_failures += 1
        cooldown = min(
            COOLDOWN_BASE * (2 ** (entry.consecutive_failures - 1)),
            COOLDOWN_MAX,
        )
        entry.skip_until = time.time() + cooldown
        logger.warning(
            "Proxy %s failed (%d consecutive), cooldown %.0fs",
            entry.url, entry.consecutive_failures, cooldown,
        )

    async def aclose(self):
        for entry in self._entries:
            try:
                await entry.client.aclose()
            except Exception:
                pass
        self._entries.clear()
