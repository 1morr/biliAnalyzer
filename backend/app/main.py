from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
    await init_db()
    yield


app = FastAPI(title="BiliAnalyzer", lifespan=lifespan)

# CORS
if settings.CORS_ORIGINS:
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
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

# Serve frontend static files (only when built dist exists)
_dist = Path("/app/frontend/dist")
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(_dist / "index.html")
