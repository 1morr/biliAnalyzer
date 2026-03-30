from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.DATA_DIR, "wordclouds").mkdir(parents=True, exist_ok=True)
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

from app.api import fetch, queries, videos

app.include_router(fetch.router, prefix="/api", tags=["fetch"])
app.include_router(queries.router, prefix="/api", tags=["queries"])
app.include_router(videos.router, prefix="/api", tags=["videos"])
