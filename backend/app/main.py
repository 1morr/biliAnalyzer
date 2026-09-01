import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select
from app.core.config import settings
from app.core.database import async_session, init_db
from app.models import Query

logger = logging.getLogger(__name__)

# Statuses a query/sentiment run can be left in if the process dies mid-scrape.
NON_TERMINAL_QUERY_STATUSES = ("pending", "fetching", "fetching_content")
NON_TERMINAL_SENTIMENT_STATUSES = ("analyzing",)


async def _reset_interrupted_queries() -> None:
    """A query stuck at fetching/fetching_content/analyzing when the process
    restarts (e.g. a container redeploy mid-scrape) would otherwise show that
    status forever, since nothing is left running to advance it."""
    async with async_session() as db:
        result = await db.execute(select(Query).where(Query.status.in_(NON_TERMINAL_QUERY_STATUSES)))
        stuck_queries = result.scalars().all()
        for query in stuck_queries:
            query.status = "error"
            query.error_message = "Interrupted by server restart"
            query.progress = None

        result = await db.execute(select(Query).where(Query.sentiment_status.in_(NON_TERMINAL_SENTIMENT_STATUSES)))
        stuck_sentiment = result.scalars().all()
        for query in stuck_sentiment:
            query.sentiment_status = "error"
            query.progress = None

        if stuck_queries or stuck_sentiment:
            await db.commit()
            logger.warning(
                "Reset %d interrupted quer(ies) and %d interrupted sentiment run(s) on startup",
                len(stuck_queries), len(stuck_sentiment),
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
    await init_db()
    await _reset_interrupted_queries()
    yield


app = FastAPI(title="BiliAnalyzer", lifespan=lifespan)

# CORS
if settings.CORS_ORIGINS:
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
    allow_credentials = True
    if origins == ["*"]:
        # A wildcard origin combined with allow_credentials=True is rejected by
        # browsers anyway (and is a CSRF-adjacent misconfiguration), so drop
        # credentials rather than silently shipping a broken/insecure policy.
        allow_credentials = False
        logger.warning("CORS_ORIGINS=* set; disabling allow_credentials for a wildcard CORS policy")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

from app.api import fetch, queries, videos, analytics, ai, settings as settings_api, sentiment

app.include_router(fetch.router, prefix="/api", tags=["fetch"])
app.include_router(queries.router, prefix="/api", tags=["queries"])
app.include_router(videos.router, prefix="/api", tags=["videos"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
app.include_router(ai.router, prefix="/api", tags=["ai"])
app.include_router(settings_api.router, prefix="/api", tags=["settings"])
app.include_router(sentiment.router, prefix="/api", tags=["sentiment"])

# Serve the built frontend, when there is one.
#
# In the container the build is copied to /app/frontend/dist. Running from a
# checkout it sits next to the backend instead, so look there too — otherwise
# `uvicorn app.main:app` serves the API with no UI and the only way to see the
# app locally is to run Vite on a second port.
def _find_dist() -> Path:
    candidates = (
        Path("/app/frontend/dist"),
        Path(__file__).resolve().parents[2] / "frontend" / "dist",
    )
    return next((p for p in candidates if p.is_dir()), candidates[0])


_dist = _find_dist()
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(_dist / "index.html")
