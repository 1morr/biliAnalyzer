# BiliAnalyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bilibili video analytics dashboard with data fetching, visualization, word clouds, and AI-powered content analysis.

**Architecture:** Monolithic async backend (FastAPI + SQLite) serving a React SPA. Bilibili data fetched via public/authenticated APIs with WBI signature support. Word clouds generated server-side with jieba. AI analysis via OpenAI-compatible API with SSE streaming.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), aiosqlite, httpx, jieba, wordcloud, openai SDK | Vite, React 18, TypeScript, Shadcn/ui, ECharts, react-i18next | Docker Compose

**Spec:** `docs/superpowers/specs/2026-03-30-bili-analyzer-design.md`

---

## File Structure

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `app/main.py` | FastAPI app, CORS, router mounting, lifespan |
| `app/core/config.py` | Pydantic Settings, env var loading |
| `app/core/database.py` | Async engine, session factory, init_db |
| `app/core/security.py` | Fernet encryption/decryption helpers |
| `app/core/deps.py` | FastAPI dependency injection (get_db) |
| `app/models/__init__.py` | Re-export all models |
| `app/models/user.py` | User SQLAlchemy model |
| `app/models/video.py` | Video, VideoStats, VideoContent models |
| `app/models/query.py` | Query, QueryVideo models |
| `app/models/settings.py` | AppSettings model |
| `app/schemas/query.py` | Pydantic schemas for query req/res |
| `app/schemas/video.py` | Pydantic schemas for video req/res |
| `app/schemas/settings.py` | Pydantic schemas for settings req/res |
| `app/schemas/analytics.py` | Pydantic schemas for analytics/stats |
| `app/services/bilibili.py` | Bilibili API client (WBI, user, video, comments, danmaku, subtitle) |
| `app/services/wordcloud_svc.py` | jieba segmentation + wordcloud PNG generation |
| `app/services/ai_analysis.py` | AI prompt construction + OpenAI streaming |
| `app/services/fetch_task.py` | Background fetch orchestration |
| `app/api/fetch.py` | POST /api/fetch |
| `app/api/queries.py` | Query CRUD endpoints |
| `app/api/videos.py` | Video detail endpoint |
| `app/api/analytics.py` | Stats, trends, word cloud endpoints |
| `app/api/ai.py` | AI analysis SSE endpoint |
| `app/api/settings.py` | Settings CRUD endpoints |
| `requirements.txt` | Python dependencies |
| `pyproject.toml` | Project metadata |
| `Dockerfile` | Backend Docker image |

### Frontend (`frontend/`)

| File | Responsibility |
|------|---------------|
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Router + layout + theme provider |
| `src/lib/utils.ts` | cn(), formatNumber(), formatDuration() |
| `src/lib/api.ts` | Fetch wrapper with base URL, error handling |
| `src/types/index.ts` | TypeScript interfaces (Query, Video, Stats, etc.) |
| `src/i18n/index.ts` | i18next configuration |
| `src/i18n/locales/zh.json` | Chinese translations |
| `src/i18n/locales/en.json` | English translations |
| `src/hooks/useTheme.ts` | Dark/light/system theme hook |
| `src/hooks/useQueries.ts` | Query list + polling hook |
| `src/services/api.ts` | API client functions (typed) |
| `src/components/ui/` | Shadcn components (installed via CLI) |
| `src/components/layout/Sidebar.tsx` | Query history sidebar |
| `src/components/layout/TopBar.tsx` | Page top bar with theme toggle |
| `src/components/layout/AppLayout.tsx` | Sidebar + main content layout |
| `src/components/dashboard/StatsCards.tsx` | 8 summary stat cards |
| `src/components/dashboard/ViewsTrendChart.tsx` | ECharts views trend |
| `src/components/dashboard/InteractionChart.tsx` | ECharts interaction comparison |
| `src/components/dashboard/ScatterChart.tsx` | Views vs interaction rate scatter |
| `src/components/dashboard/WordCloudGrid.tsx` | 4 word cloud images |
| `src/components/dashboard/VideoList.tsx` | Sortable paginated video list |
| `src/components/dashboard/AIPanel.tsx` | AI analysis slide-over panel |
| `src/components/dashboard/NewQueryDialog.tsx` | New query modal |
| `src/components/video/VideoHeader.tsx` | Video cover, title, tags |
| `src/components/video/VideoStatsCards.tsx` | 8 stat cards for single video |
| `src/components/video/RadarChart.tsx` | ECharts radar vs average |
| `src/components/video/ComparisonBars.tsx` | Horizontal vs-average bars |
| `src/components/video/VideoWordClouds.tsx` | 2 word clouds (content, interaction) |
| `src/pages/Dashboard.tsx` | Dashboard page (query detail) |
| `src/pages/VideoDetail.tsx` | Single video analysis page |
| `src/pages/Settings.tsx` | Settings page |
| `nginx.conf` | Nginx config for production |
| `Dockerfile` | Frontend Docker image |

### Root

| File | Responsibility |
|------|---------------|
| `docker-compose.yml` | Multi-service orchestration |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore rules |

---

## Phase 1: Backend Core Setup

### Task 1: Initialize backend project and dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0.0
aiosqlite>=0.20.0
httpx>=0.27.0
jieba>=0.42.1
wordcloud>=1.9.0
openai>=1.50.0
cryptography>=43.0.0
python-dotenv>=1.0.0
pydantic-settings>=2.0.0
sse-starlette>=2.0.0
```

- [ ] **Step 2: Create pyproject.toml**

```toml
[project]
name = "bilianalyzer-backend"
version = "0.1.0"
requires-python = ">=3.11"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: Create empty __init__.py files**

Create: `backend/app/__init__.py`, `backend/app/core/__init__.py`, `backend/app/models/__init__.py`, `backend/app/schemas/__init__.py`, `backend/app/services/__init__.py`, `backend/app/api/__init__.py`

- [ ] **Step 4: Install dependencies and verify**

Run: `cd backend && pip install -r requirements.txt`
Expected: All packages install successfully.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "chore: initialize backend project with dependencies"
```

---

### Task 2: Core config and database setup

**Files:**
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/deps.py`
- Create: `backend/.env.example`

- [ ] **Step 1: Create config.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/bilianalyzer.db"
    SECRET_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173"
    DATA_DIR: str = "./data"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 2: Create database.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 3: Create deps.py**

```python
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

- [ ] **Step 4: Create .env.example**

```bash
DATABASE_URL=sqlite+aiosqlite:///./data/bilianalyzer.db
SECRET_KEY=
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/ backend/.env.example
git commit -m "feat: add core config, database, and dependency injection"
```

---

### Task 3: Security module (Fernet encryption)

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/tests/test_security.py`

- [ ] **Step 1: Write tests for encryption**

```python
# backend/tests/test_security.py
import pytest
from app.core.security import encrypt_value, decrypt_value, get_fernet

def test_encrypt_decrypt_roundtrip():
    fernet = get_fernet()
    original = "test_api_key_12345"
    encrypted = encrypt_value(original, fernet)
    assert encrypted != original
    decrypted = decrypt_value(encrypted, fernet)
    assert decrypted == original

def test_encrypt_produces_different_output():
    fernet = get_fernet()
    val = "same_value"
    e1 = encrypt_value(val, fernet)
    e2 = encrypt_value(val, fernet)
    # Fernet includes timestamp, so outputs differ
    assert e1 != e2

def test_decrypt_invalid_token():
    fernet = get_fernet()
    with pytest.raises(Exception):
        decrypt_value("not-a-valid-token", fernet)
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python -m pytest tests/test_security.py -v`

- [ ] **Step 3: Implement security.py**

```python
# backend/app/core/security.py
import os
from pathlib import Path
from cryptography.fernet import Fernet
from app.core.config import settings

_fernet_instance: Fernet | None = None

def get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = settings.SECRET_KEY
    if not key:
        key_path = Path(settings.DATA_DIR) / ".secret_key"
        if key_path.exists():
            key = key_path.read_text().strip()
        else:
            key = Fernet.generate_key().decode()
            key_path.parent.mkdir(parents=True, exist_ok=True)
            key_path.write_text(key)

    _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet_instance

def encrypt_value(value: str, fernet: Fernet | None = None) -> str:
    f = fernet or get_fernet()
    return f.encrypt(value.encode()).decode()

def decrypt_value(token: str, fernet: Fernet | None = None) -> str:
    f = fernet or get_fernet()
    return f.decrypt(token.encode()).decode()
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python -m pytest tests/test_security.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/security.py backend/tests/
git commit -m "feat: add Fernet encryption for sensitive settings"
```

---

### Task 4: SQLAlchemy models

**Files:**
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/video.py`
- Create: `backend/app/models/query.py`
- Create: `backend/app/models/settings.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Create User model**

```python
# backend/app/models/user.py
from datetime import datetime
from sqlalchemy import Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    uid: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 2: Create Video, VideoStats, VideoContent models**

```python
# backend/app/models/video.py
from datetime import datetime
from sqlalchemy import Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Video(Base):
    __tablename__ = "videos"

    bvid: Mapped[str] = mapped_column(Text, primary_key=True)
    aid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uid: Mapped[int] = mapped_column(Integer, ForeignKey("users.uid"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    stats: Mapped[list["VideoStats"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    content: Mapped[list["VideoContent"]] = relationship(back_populates="video", cascade="all, delete-orphan")

class VideoStats(Base):
    __tablename__ = "video_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bvid: Mapped[str] = mapped_column(Text, ForeignKey("videos.bvid"), nullable=False)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    favorites: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    danmaku_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    video: Mapped["Video"] = relationship(back_populates="stats")

class VideoContent(Base):
    __tablename__ = "video_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bvid: Mapped[str] = mapped_column(Text, ForeignKey("videos.bvid"), nullable=False)
    danmakus: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    video: Mapped["Video"] = relationship(back_populates="content")
```

- [ ] **Step 3: Create Query, QueryVideo models**

```python
# backend/app/models/query.py
from datetime import date, datetime
from sqlalchemy import Integer, Text, Date, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class QueryVideo(Base):
    __tablename__ = "query_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_id: Mapped[int] = mapped_column(Integer, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False)
    bvid: Mapped[str] = mapped_column(Text, ForeignKey("videos.bvid"), nullable=False)

    __table_args__ = (UniqueConstraint("query_id", "bvid"),)

class Query(Base):
    __tablename__ = "queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uid: Mapped[int] = mapped_column(Integer, nullable=False)
    user_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="pending")
    progress: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    total_views: Mapped[int] = mapped_column(Integer, default=0)
    total_likes: Mapped[int] = mapped_column(Integer, default=0)
    total_coins: Mapped[int] = mapped_column(Integer, default=0)
    total_favorites: Mapped[int] = mapped_column(Integer, default=0)
    total_shares: Mapped[int] = mapped_column(Integer, default=0)
    total_danmaku: Mapped[int] = mapped_column(Integer, default=0)
    total_comments: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    videos: Mapped[list[QueryVideo]] = relationship(cascade="all, delete-orphan")
```

- [ ] **Step 4: Create AppSettings model**

```python
# backend/app/models/settings.py
from sqlalchemy import Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class AppSettings(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
```

- [ ] **Step 5: Update models/__init__.py to re-export all**

```python
# backend/app/models/__init__.py
from app.models.user import User
from app.models.video import Video, VideoStats, VideoContent
from app.models.query import Query, QueryVideo
from app.models.settings import AppSettings

__all__ = ["User", "Video", "VideoStats", "VideoContent", "Query", "QueryVideo", "AppSettings"]
```

- [ ] **Step 6: Write model test (table creation)**

```python
# backend/tests/test_models.py
import pytest
from sqlalchemy import inspect
from app.core.database import engine, init_db

@pytest.fixture(autouse=True)
async def setup_db():
    await init_db()
    yield

async def test_all_tables_created():
    async with engine.connect() as conn:
        table_names = await conn.run_sync(lambda c: inspect(c).get_table_names())
    expected = {"users", "videos", "video_stats", "video_content", "queries", "query_videos", "app_settings"}
    assert expected.issubset(set(table_names))
```

- [ ] **Step 7: Run tests — expect PASS**

Run: `cd backend && python -m pytest tests/test_models.py -v`

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/ backend/tests/test_models.py
git commit -m "feat: add all SQLAlchemy models"
```

---

### Task 5: Pydantic schemas

**Files:**
- Create: `backend/app/schemas/query.py`
- Create: `backend/app/schemas/video.py`
- Create: `backend/app/schemas/settings.py`
- Create: `backend/app/schemas/analytics.py`

- [ ] **Step 1: Create query schemas**

```python
# backend/app/schemas/query.py
from datetime import date, datetime
from pydantic import BaseModel

class FetchRequest(BaseModel):
    uid: int
    start_date: date
    end_date: date

class FetchResponse(BaseModel):
    query_id: int
    status: str

class QuerySummary(BaseModel):
    id: int
    uid: int
    user_name: str | None
    start_date: date
    end_date: date
    status: str
    progress: str | None
    video_count: int
    total_views: int
    created_at: datetime

class QueryDetail(QuerySummary):
    error_message: str | None
    total_likes: int
    total_coins: int
    total_favorites: int
    total_shares: int
    total_danmaku: int
    total_comments: int
```

- [ ] **Step 2: Create video schemas**

```python
# backend/app/schemas/video.py
from datetime import datetime
from pydantic import BaseModel

class VideoStatsSchema(BaseModel):
    views: int
    likes: int
    coins: int
    favorites: int
    shares: int
    danmaku_count: int
    comment_count: int
    interaction_rate: float  # computed: (likes+coins+favorites+shares)/views*100

class VideoSummary(BaseModel):
    bvid: str
    title: str
    cover_url: str | None
    duration: int
    published_at: datetime | None
    tags: str | None
    stats: VideoStatsSchema

class VideoDetail(VideoSummary):
    aid: int | None
    cid: int | None
    description: str | None
    has_danmaku: bool
    has_subtitle: bool

class PaginatedVideos(BaseModel):
    items: list[VideoSummary]
    total: int
    page: int
    page_size: int
    total_pages: int
```

- [ ] **Step 3: Create settings schemas**

```python
# backend/app/schemas/settings.py
from pydantic import BaseModel

class SettingsResponse(BaseModel):
    sessdata: str  # masked if set
    ai_base_url: str
    ai_api_key: str  # masked if set
    ai_model: str

class SettingsUpdate(BaseModel):
    sessdata: str | None = None
    ai_base_url: str | None = None
    ai_api_key: str | None = None
    ai_model: str | None = None
```

- [ ] **Step 4: Create analytics schemas**

```python
# backend/app/schemas/analytics.py
from pydantic import BaseModel

class StatsSummary(BaseModel):
    total_views: int
    total_likes: int
    total_coins: int
    total_favorites: int
    total_shares: int
    total_danmaku: int
    total_comments: int
    video_count: int

class TrendPoint(BaseModel):
    date: str
    views: int

class InteractionData(BaseModel):
    likes: int
    coins: int
    favorites: int
    shares: int

class VideoComparison(BaseModel):
    """For radar chart: this video's stats vs query average"""
    metrics: list[str]
    video_values: list[float]
    average_values: list[float]
    percentage_diff: list[float]
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic request/response schemas"
```

---

### Task 6: FastAPI app entry point

**Files:**
- Create: `backend/app/main.py`

- [ ] **Step 1: Create main.py with CORS and lifespan**

```python
# backend/app/main.py
import os
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

# Routers will be added in subsequent tasks
# from app.api import fetch, queries, videos, analytics, ai, settings as settings_api
# app.include_router(fetch.router, prefix="/api")
# ...
```

- [ ] **Step 2: Verify the app starts**

Run: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
Expected: Server starts, visit `http://localhost:8000/docs` shows empty Swagger UI.

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add FastAPI app entry point with CORS and lifespan"
```

---

## Phase 2: Bilibili API Client

### Task 7: WBI signature implementation

**Files:**
- Create: `backend/app/services/bilibili.py`
- Create: `backend/tests/test_bilibili.py`

Reference: bilibili-API-collect community docs for WBI mixin key algorithm.

- [ ] **Step 1: Write WBI signature test**

```python
# backend/tests/test_bilibili.py
import pytest
from app.services.bilibili import BilibiliClient

def test_get_mixin_key():
    """Test mixin key derivation from img_key + sub_key using known values."""
    client = BilibiliClient.__new__(BilibiliClient)
    # Use known test vectors from bilibili-API-collect
    img_key = "7cd084941338484aae1ad9425b84077c"
    sub_key = "4932caff0ff746eab6f01bf08b70ac45"
    mixin_key = client._get_mixin_key(img_key + sub_key)
    assert len(mixin_key) == 32
    assert isinstance(mixin_key, str)

def test_sign_params():
    client = BilibiliClient.__new__(BilibiliClient)
    client._img_key = "7cd084941338484aae1ad9425b84077c"
    client._sub_key = "4932caff0ff746eab6f01bf08b70ac45"
    params = {"mid": 546195}
    signed = client._sign_wbi(params)
    assert "w_rid" in signed
    assert "wts" in signed
    assert "mid" in signed
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python -m pytest tests/test_bilibili.py -v`

- [ ] **Step 3: Implement BilibiliClient with WBI signing**

```python
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

    # --- Public API methods (implemented in next tasks) ---
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python -m pytest tests/test_bilibili.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/bilibili.py backend/tests/test_bilibili.py
git commit -m "feat: add Bilibili API client with WBI signature"
```

---

### Task 8: Bilibili data fetching methods

**Files:**
- Modify: `backend/app/services/bilibili.py`

- [ ] **Step 1: Add user info method**

```python
    async def get_user_info(self, uid: int) -> dict:
        data = await self._request(
            f"{self.BASE}/x/space/wbi/acc/info",
            params={"mid": uid}, wbi=True
        )
        info = data["data"]
        return {"uid": uid, "name": info["name"], "avatar_url": info["face"]}
```

- [ ] **Step 2: Add video list method**

```python
    async def get_video_list(self, uid: int, page: int = 1, page_size: int = 50) -> dict:
        data = await self._request(
            f"{self.BASE}/x/space/wbi/arc/search",
            params={"mid": uid, "ps": page_size, "pn": page, "order": "pubdate"},
            wbi=True
        )
        vlist = data["data"]["list"]["vlist"]
        total = data["data"]["page"]["count"]
        return {"videos": vlist, "total": total, "page": page}
```

- [ ] **Step 3: Add video detail method**

```python
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
```

- [ ] **Step 4: Add comments method**

```python
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
```

- [ ] **Step 5: Add danmaku method (requires SESSDATA)**

```python
    async def get_danmakus(self, cid: int) -> list[str]:
        if not self._sessdata:
            return []
        await self._throttle()
        async with httpx.AsyncClient(cookies=self._get_cookies(), timeout=30) as client:
            resp = await client.get(f"https://comment.bilibili.com/{cid}.xml")
            resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)
        return [d.text for d in root.findall(".//d") if d.text]
```

- [ ] **Step 6: Add subtitle method (requires SESSDATA)**

```python
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
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/bilibili.py
git commit -m "feat: add Bilibili data fetching methods (user, videos, comments, danmaku, subtitle)"
```

---

## Phase 3: Backend Services & API Endpoints

### Task 9: Background fetch task service

**Files:**
- Create: `backend/app/services/fetch_task.py`

- [ ] **Step 1: Create fetch orchestration service**

```python
# backend/app/services/fetch_task.py
import json
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session
from app.models import User, Video, VideoStats, VideoContent, Query, QueryVideo
from app.services.bilibili import BilibiliClient

async def run_fetch(query_id: int, uid: int, start_date, end_date, sessdata: str | None):
    """Background task: fetch all video data for a query."""
    async with async_session() as db:
        query = await db.get(Query, query_id)
        if not query:
            return
        try:
            client = BilibiliClient(sessdata=sessdata)

            # Step 1: Fetch user info
            query.status = "fetching"
            query.progress = "Fetching user info..."
            await db.commit()

            user_info = await client.get_user_info(uid)
            existing_user = await db.get(User, uid)
            if existing_user:
                existing_user.name = user_info["name"]
                existing_user.avatar_url = user_info["avatar_url"]
                existing_user.last_fetched_at = datetime.now(timezone.utc)
            else:
                db.add(User(uid=uid, name=user_info["name"],
                           avatar_url=user_info["avatar_url"],
                           last_fetched_at=datetime.now(timezone.utc)))
            query.user_name = user_info["name"]
            await db.commit()

            # Step 2: Fetch video list
            all_videos = []
            page = 1
            while True:
                result = await client.get_video_list(uid, page=page)
                for v in result["videos"]:
                    pub_ts = v.get("created", 0)
                    pub_date = datetime.fromtimestamp(pub_ts, tz=timezone.utc).date()
                    if start_date <= pub_date <= end_date:
                        all_videos.append(v)
                if page * 50 >= result["total"]:
                    break
                # Early exit if we've passed the date range
                if result["videos"]:
                    oldest_ts = min(v.get("created", 0) for v in result["videos"])
                    if datetime.fromtimestamp(oldest_ts, tz=timezone.utc).date() < start_date:
                        break
                page += 1

            total = len(all_videos)
            query.video_count = total
            await db.commit()

            # Step 3: Fetch details for each video
            for i, v in enumerate(all_videos, 1):
                query.progress = f"Fetching video {i}/{total}"
                await db.commit()

                bvid = v["bvid"]
                detail = await client.get_video_detail(bvid)

                # Upsert Video
                existing = await db.get(Video, bvid)
                if not existing:
                    video = Video(
                        bvid=bvid, aid=detail["aid"], cid=detail["cid"],
                        uid=uid, title=detail["title"],
                        description=detail["description"],
                        cover_url=detail["cover_url"], duration=detail["duration"],
                        published_at=datetime.fromtimestamp(detail["published_at"], tz=timezone.utc),
                        tags=detail["tags"],
                    )
                    db.add(video)
                else:
                    existing.title = detail["title"]
                    existing.tags = detail["tags"]
                    existing.updated_at = datetime.now(timezone.utc)

                # Add stats snapshot
                s = detail["stats"]
                db.add(VideoStats(
                    bvid=bvid, views=s["views"], likes=s["likes"],
                    coins=s["coins"], favorites=s["favorites"],
                    shares=s["shares"], danmaku_count=s["danmaku_count"],
                    comment_count=s["comment_count"],
                ))

                # Link to query
                db.add(QueryVideo(query_id=query_id, bvid=bvid))
                await db.commit()

            # Step 4: Fetch content
            query.status = "fetching_content"
            await db.commit()

            for i, v in enumerate(all_videos, 1):
                query.progress = f"Fetching content {i}/{total}"
                await db.commit()

                bvid = v["bvid"]
                video = await db.get(Video, bvid)
                aid = video.aid
                cid = video.cid

                comments = await client.get_comments(aid) if aid else []
                danmakus = await client.get_danmakus(cid) if cid else []
                subtitle = await client.get_subtitle(bvid, cid) if cid else ""

                db.add(VideoContent(
                    bvid=bvid,
                    comments=json.dumps(comments, ensure_ascii=False),
                    danmakus=json.dumps(danmakus, ensure_ascii=False),
                    subtitle=subtitle,
                ))
                await db.commit()

            # Step 5: Compute aggregates
            stmt = (select(VideoStats)
                    .join(QueryVideo, QueryVideo.bvid == VideoStats.bvid)
                    .where(QueryVideo.query_id == query_id))
            result = await db.execute(stmt)
            stats_list = result.scalars().all()

            # Use latest stats per video
            latest: dict[str, VideoStats] = {}
            for s in stats_list:
                if s.bvid not in latest or s.fetched_at > latest[s.bvid].fetched_at:
                    latest[s.bvid] = s

            query.total_views = sum(s.views for s in latest.values())
            query.total_likes = sum(s.likes for s in latest.values())
            query.total_coins = sum(s.coins for s in latest.values())
            query.total_favorites = sum(s.favorites for s in latest.values())
            query.total_shares = sum(s.shares for s in latest.values())
            query.total_danmaku = sum(s.danmaku_count for s in latest.values())
            query.total_comments = sum(s.comment_count for s in latest.values())
            query.status = "done"
            query.progress = None
            await db.commit()

        except Exception as e:
            query.status = "error"
            query.error_message = str(e)
            await db.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/fetch_task.py
git commit -m "feat: add background fetch task orchestration"
```

---

### Task 10: Query and Fetch API endpoints

**Files:**
- Create: `backend/app/api/fetch.py`
- Create: `backend/app/api/queries.py`
- Modify: `backend/app/main.py` (register routers)

- [ ] **Step 1: Create fetch endpoint**

```python
# backend/app/api/fetch.py
import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, AppSettings
from app.schemas.query import FetchRequest, FetchResponse
from app.services.fetch_task import run_fetch
from app.core.security import decrypt_value

router = APIRouter()

@router.post("/fetch", response_model=FetchResponse)
async def create_fetch(req: FetchRequest, db: AsyncSession = Depends(get_db)):
    query = Query(uid=req.uid, start_date=req.start_date, end_date=req.end_date, status="pending")
    db.add(query)
    await db.commit()
    await db.refresh(query)

    # Get SESSDATA if configured
    sessdata_row = await db.get(AppSettings, "sessdata")
    sessdata = None
    if sessdata_row and sessdata_row.value:
        try:
            sessdata = decrypt_value(sessdata_row.value) if sessdata_row.is_sensitive else sessdata_row.value
        except Exception:
            pass

    asyncio.create_task(run_fetch(query.id, req.uid, req.start_date, req.end_date, sessdata))
    return FetchResponse(query_id=query.id, status="pending")
```

- [ ] **Step 2: Create queries endpoints**

```python
# backend/app/api/queries.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video, VideoStats, VideoContent
from app.schemas.query import QuerySummary, QueryDetail

router = APIRouter()

@router.get("/queries", response_model=list[QuerySummary])
async def list_queries(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Query).order_by(Query.created_at.desc()))
    return result.scalars().all()

@router.get("/queries/{query_id}", response_model=QueryDetail)
async def get_query(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    return query

@router.delete("/queries/{query_id}")
async def delete_query(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    # Get video bvids for this query
    qv_result = await db.execute(select(QueryVideo.bvid).where(QueryVideo.query_id == query_id))
    bvids = [r[0] for r in qv_result.all()]

    # Delete query (cascades QueryVideo)
    await db.delete(query)
    await db.flush()

    # Clean up orphaned videos
    for bvid in bvids:
        remaining = await db.execute(
            select(func.count()).select_from(QueryVideo).where(QueryVideo.bvid == bvid)
        )
        if remaining.scalar() == 0:
            video = await db.get(Video, bvid)
            if video:
                await db.delete(video)  # cascades stats + content

    await db.commit()
    return {"status": "deleted"}
```

- [ ] **Step 3: Register routers in main.py**

Add to `backend/app/main.py` after app creation:

```python
from app.api import fetch, queries

app.include_router(fetch.router, prefix="/api", tags=["fetch"])
app.include_router(queries.router, prefix="/api", tags=["queries"])
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/fetch.py backend/app/api/queries.py backend/app/main.py
git commit -m "feat: add fetch and query API endpoints"
```

---

### Task 11: Videos API endpoint

**Files:**
- Create: `backend/app/api/videos.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create videos endpoints**

```python
# backend/app/api/videos.py
import math
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy import select, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Video, VideoStats, VideoContent, QueryVideo
from app.schemas.video import VideoDetail, VideoSummary, VideoStatsSchema, PaginatedVideos

router = APIRouter()

def _compute_interaction_rate(s: VideoStats) -> float:
    if not s.views:
        return 0.0
    return round((s.likes + s.coins + s.favorites + s.shares) / s.views * 100, 2)

def _stats_to_schema(s: VideoStats) -> VideoStatsSchema:
    return VideoStatsSchema(
        views=s.views, likes=s.likes, coins=s.coins,
        favorites=s.favorites, shares=s.shares,
        danmaku_count=s.danmaku_count, comment_count=s.comment_count,
        interaction_rate=_compute_interaction_rate(s),
    )

SORT_FIELDS = {
    "views": VideoStats.views, "likes": VideoStats.likes,
    "coins": VideoStats.coins, "favorites": VideoStats.favorites,
    "shares": VideoStats.shares, "danmaku": VideoStats.danmaku_count,
    "comments": VideoStats.comment_count, "published_at": Video.published_at,
}

@router.get("/queries/{query_id}/videos", response_model=PaginatedVideos)
async def list_videos(
    query_id: int,
    sort_by: str = "views",
    order: str = "desc",
    page: int = 1,
    page_size: int = QueryParam(default=20, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Build query: join Video + latest VideoStats via QueryVideo
    base = (
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    # For simplicity, get all then sort in Python (video count is typically < 1000)
    result = await db.execute(base)
    rows = result.all()

    # Keep latest stats per video
    latest: dict[str, tuple[Video, VideoStats]] = {}
    for video, stats in rows:
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid][1].fetched_at:
            latest[video.bvid] = (video, stats)

    items = list(latest.values())

    # Sort
    sort_key = sort_by if sort_by in SORT_FIELDS else "views"
    if sort_key == "published_at":
        items.sort(key=lambda x: x[0].published_at or 0, reverse=(order == "desc"))
    else:
        field_name = sort_key if sort_key != "danmaku" else "danmaku_count"
        field_name = field_name if field_name != "comments" else "comment_count"
        items.sort(key=lambda x: getattr(x[1], field_name, 0), reverse=(order == "desc"))

    total = len(items)
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    page_items = items[(page - 1) * page_size : page * page_size]

    return PaginatedVideos(
        items=[
            VideoSummary(
                bvid=v.bvid, title=v.title, cover_url=v.cover_url,
                duration=v.duration, published_at=v.published_at,
                tags=v.tags, stats=_stats_to_schema(s),
            )
            for v, s in page_items
        ],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    )

@router.get("/videos/{bvid}", response_model=VideoDetail)
async def get_video(bvid: str, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    stats_result = await db.execute(
        select(VideoStats).where(VideoStats.bvid == bvid).order_by(VideoStats.fetched_at.desc()).limit(1)
    )
    stats = stats_result.scalar_one_or_none()
    if not stats:
        raise HTTPException(status_code=404, detail="No stats found")

    content_result = await db.execute(
        select(VideoContent).where(VideoContent.bvid == bvid).order_by(VideoContent.fetched_at.desc()).limit(1)
    )
    content = content_result.scalar_one_or_none()

    return VideoDetail(
        bvid=video.bvid, aid=video.aid, cid=video.cid,
        title=video.title, description=video.description,
        cover_url=video.cover_url, duration=video.duration,
        published_at=video.published_at, tags=video.tags,
        stats=_stats_to_schema(stats),
        has_danmaku=bool(content and content.danmakus and content.danmakus != "[]"),
        has_subtitle=bool(content and content.subtitle),
    )
```

- [ ] **Step 2: Register in main.py**

```python
from app.api import fetch, queries, videos
app.include_router(videos.router, prefix="/api", tags=["videos"])
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/videos.py backend/app/main.py
git commit -m "feat: add video list and detail API endpoints"
```

---

### Task 12: Analytics API endpoints (stats, trends)

**Files:**
- Create: `backend/app/api/analytics.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create analytics endpoints**

```python
# backend/app/api/analytics.py
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import Query, QueryVideo, Video, VideoStats, VideoContent
from app.schemas.analytics import StatsSummary, TrendPoint, InteractionData, VideoComparison

router = APIRouter()

@router.get("/queries/{query_id}/stats/summary", response_model=StatsSummary)
async def stats_summary(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404)
    return StatsSummary(
        total_views=query.total_views, total_likes=query.total_likes,
        total_coins=query.total_coins, total_favorites=query.total_favorites,
        total_shares=query.total_shares, total_danmaku=query.total_danmaku,
        total_comments=query.total_comments, video_count=query.video_count,
    )

@router.get("/queries/{query_id}/stats/trend", response_model=list[TrendPoint])
async def stats_trend(query_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()

    # Latest stats per video, grouped by publish month
    latest: dict[str, tuple[Video, VideoStats]] = {}
    for video, stats in rows:
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid][1].fetched_at:
            latest[video.bvid] = (video, stats)

    monthly: dict[str, int] = defaultdict(int)
    for video, stats in latest.values():
        if video.published_at:
            key = video.published_at.strftime("%Y-%m")
            monthly[key] += stats.views

    return [TrendPoint(date=k, views=v) for k, v in sorted(monthly.items())]

@router.get("/queries/{query_id}/stats/interaction", response_model=InteractionData)
async def stats_interaction(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404)
    return InteractionData(
        likes=query.total_likes, coins=query.total_coins,
        favorites=query.total_favorites, shares=query.total_shares,
    )

@router.get("/videos/{bvid}/stats/comparison", response_model=VideoComparison)
async def video_comparison(
    bvid: str,
    query_id: int = QueryParam(...),
    db: AsyncSession = Depends(get_db),
):
    # Get this video's latest stats
    stats_result = await db.execute(
        select(VideoStats).where(VideoStats.bvid == bvid).order_by(VideoStats.fetched_at.desc()).limit(1)
    )
    video_stats = stats_result.scalar_one_or_none()
    if not video_stats:
        raise HTTPException(status_code=404)

    # Get query averages
    all_result = await db.execute(
        select(VideoStats)
        .join(QueryVideo, QueryVideo.bvid == VideoStats.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    all_stats = all_result.scalars().all()

    latest_per: dict[str, VideoStats] = {}
    for s in all_stats:
        if s.bvid not in latest_per or s.fetched_at > latest_per[s.bvid].fetched_at:
            latest_per[s.bvid] = s

    count = len(latest_per) or 1
    metrics = ["views", "likes", "coins", "favorites", "shares", "danmaku_count", "comment_count"]
    labels = ["Views", "Likes", "Coins", "Favorites", "Shares", "Danmaku", "Comments"]

    video_values = [float(getattr(video_stats, m)) for m in metrics]
    avg_values = [sum(getattr(s, m) for s in latest_per.values()) / count for m in metrics]
    pct_diff = [
        round((v - a) / a * 100, 1) if a > 0 else 0.0
        for v, a in zip(video_values, avg_values)
    ]

    return VideoComparison(
        metrics=labels, video_values=video_values,
        average_values=[round(a, 1) for a in avg_values],
        percentage_diff=pct_diff,
    )
```

- [ ] **Step 2: Register in main.py**

```python
from app.api import fetch, queries, videos, analytics
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/analytics.py backend/app/main.py
git commit -m "feat: add analytics endpoints (summary, trend, interaction, comparison)"
```

---

### Task 13: Word cloud service and endpoints

**Files:**
- Create: `backend/app/services/wordcloud_svc.py`
- Modify: `backend/app/api/analytics.py`

- [ ] **Step 1: Create word cloud generation service**

```python
# backend/app/services/wordcloud_svc.py
import json
from pathlib import Path
import jieba
from wordcloud import WordCloud
from app.core.config import settings

# Common Chinese stop words
STOP_WORDS = set("的了是在不有和人这中大为上个国我以要他时来用们生到作地于出会s可也你对就里如被从之好最所然机与知道说本长看那但c下自现前工么都很种多将学实手世美行无才同得当已最先过身什将而做家所开意把让面公关新但已等能没理事全体之大无才多想电长民接把关正在我们".split())
STOP_WORDS.update({"", " ", "\n", "\t", "哈哈", "啊", "了", "的", "是"})

def generate_wordcloud(texts: list[str], output_path: str, width: int = 800, height: int = 400) -> str:
    """Generate word cloud from texts, save as PNG, return file path."""
    combined = " ".join(texts)
    if not combined.strip():
        return ""

    words = jieba.cut(combined)
    filtered = [w for w in words if len(w) > 1 and w not in STOP_WORDS]
    text = " ".join(filtered)

    if not text.strip():
        return ""

    wc = WordCloud(
        width=width, height=height,
        background_color="white",
        font_path=_find_cjk_font(),
        max_words=100,
        collocations=False,
    )
    wc.generate(text)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    wc.to_file(output_path)
    return output_path

def _find_cjk_font() -> str | None:
    """Find a CJK font on the system for word cloud rendering."""
    candidates = [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",  # Linux
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",  # Linux
        "C:/Windows/Fonts/msyh.ttc",  # Windows (Microsoft YaHei)
        "C:/Windows/Fonts/simhei.ttf",  # Windows (SimHei)
        "/System/Library/Fonts/PingFang.ttc",  # macOS
    ]
    for path in candidates:
        if Path(path).exists():
            return path
    return None
```

- [ ] **Step 2: Add word cloud endpoints to analytics.py**

Append to `backend/app/api/analytics.py`:

```python
from app.services.wordcloud_svc import generate_wordcloud
from app.core.config import settings as app_settings
import json
from pathlib import Path

QUERY_WC_TYPES = {"title", "tag", "danmaku", "comment"}
VIDEO_WC_TYPES = {"content", "interaction"}

@router.get("/queries/{query_id}/wordcloud/{wc_type}")
async def query_wordcloud(query_id: int, wc_type: str, db: AsyncSession = Depends(get_db)):
    if wc_type not in QUERY_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {QUERY_WC_TYPES}")

    cache_path = Path(app_settings.DATA_DIR) / "wordclouds" / f"{query_id}_{wc_type}.png"
    if cache_path.exists():
        return FileResponse(cache_path, media_type="image/png")

    # Gather texts
    result = await db.execute(
        select(Video, VideoContent)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .outerjoin(VideoContent, VideoContent.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()

    texts = []
    for video, content in rows:
        if wc_type == "title":
            texts.append(video.title or "")
        elif wc_type == "tag":
            texts.extend((video.tags or "").split(","))
        elif wc_type == "danmaku" and content and content.danmakus:
            texts.extend(json.loads(content.danmakus))
        elif wc_type == "comment" and content and content.comments:
            texts.extend(json.loads(content.comments))

    if not texts:
        raise HTTPException(status_code=404, detail="No data available for word cloud")

    output = generate_wordcloud(texts, str(cache_path))
    if not output:
        raise HTTPException(status_code=404, detail="Not enough text data")
    return FileResponse(cache_path, media_type="image/png")

@router.get("/videos/{bvid}/wordcloud/{wc_type}")
async def video_wordcloud(bvid: str, wc_type: str, db: AsyncSession = Depends(get_db)):
    if wc_type not in VIDEO_WC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {VIDEO_WC_TYPES}")

    cache_path = Path(app_settings.DATA_DIR) / "wordclouds" / f"{bvid}_{wc_type}.png"
    if cache_path.exists():
        return FileResponse(cache_path, media_type="image/png")

    video = await db.get(Video, bvid)
    if not video:
        raise HTTPException(status_code=404)

    content_result = await db.execute(
        select(VideoContent).where(VideoContent.bvid == bvid).order_by(VideoContent.fetched_at.desc()).limit(1)
    )
    content = content_result.scalar_one_or_none()

    texts = []
    if wc_type == "content":
        texts.append(video.title or "")
        texts.extend((video.tags or "").split(","))
        if content and content.subtitle:
            texts.append(content.subtitle)
    elif wc_type == "interaction":
        if content:
            if content.danmakus:
                texts.extend(json.loads(content.danmakus))
            if content.comments:
                texts.extend(json.loads(content.comments))

    if not texts:
        raise HTTPException(status_code=404, detail="No data available")

    output = generate_wordcloud(texts, str(cache_path))
    if not output:
        raise HTTPException(status_code=404, detail="Not enough text data")
    return FileResponse(cache_path, media_type="image/png")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/wordcloud_svc.py backend/app/api/analytics.py
git commit -m "feat: add word cloud generation service and endpoints"
```

---

### Task 14: AI analysis service and SSE endpoint

**Files:**
- Create: `backend/app/services/ai_analysis.py`
- Create: `backend/app/api/ai.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create AI analysis service**

```python
# backend/app/services/ai_analysis.py
import json
from collections import Counter
from openai import AsyncOpenAI

SYSTEM_PROMPT_ZH = """你是一位专业的B站内容策略分析师。根据提供的频道数据，分析以下方面：

1. **最火内容分析**：哪些视频表现最好，有什么共同特征
2. **成功因素**：标题策略、标签策略、发布时间等关键因素
3. **可执行建议**：具体的、可操作的改进建议
4. **需要改进的地方**：数据中显示的弱点和改进空间

请用清晰的分段格式回答，使用 Markdown。"""

SYSTEM_PROMPT_EN = """You are a professional Bilibili content strategist. Based on the provided channel data, analyze:

1. **Top Performers**: Which videos performed best and what common traits they share
2. **Success Factors**: Key factors like title strategy, tags, posting time
3. **Actionable Recommendations**: Specific, actionable improvement suggestions
4. **Areas to Improve**: Weaknesses shown in the data

Respond in clear sections using Markdown."""

def build_analysis_prompt(videos_data: list[dict], summary: dict, lang: str = "zh") -> list[dict]:
    system = SYSTEM_PROMPT_ZH if lang == "zh" else SYSTEM_PROMPT_EN

    # Build data summary
    top_5 = sorted(videos_data, key=lambda v: v.get("views", 0), reverse=True)[:5]
    bottom_5 = sorted(videos_data, key=lambda v: v.get("views", 0))[:5]

    all_tags = []
    for v in videos_data:
        all_tags.extend(t.strip() for t in (v.get("tags") or "").split(",") if t.strip())
    tag_freq = Counter(all_tags).most_common(20)

    data_text = f"""## Channel Summary
- Total videos: {summary['video_count']}
- Total views: {summary['total_views']:,}
- Total likes: {summary['total_likes']:,}
- Total coins: {summary['total_coins']:,}
- Total favorites: {summary['total_favorites']:,}
- Avg views per video: {summary['total_views'] // max(summary['video_count'], 1):,}
- Avg interaction rate: {_avg_interaction(videos_data):.2f}%

## Top 5 Videos
{_format_videos(top_5)}

## Bottom 5 Videos
{_format_videos(bottom_5)}

## Top Tags
{', '.join(f'{t}({c})' for t, c in tag_freq)}

## All Videos
{_format_all_videos(videos_data)}
"""
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": data_text},
    ]

def _avg_interaction(videos: list[dict]) -> float:
    total_inter = sum(v.get("likes", 0) + v.get("coins", 0) + v.get("favorites", 0) + v.get("shares", 0) for v in videos)
    total_views = sum(v.get("views", 0) for v in videos)
    return (total_inter / total_views * 100) if total_views > 0 else 0

def _format_videos(videos: list[dict]) -> str:
    lines = []
    for v in videos:
        lines.append(f"- 「{v['title']}」 views={v.get('views', 0):,} likes={v.get('likes', 0):,} coins={v.get('coins', 0):,}")
    return "\n".join(lines)

def _format_all_videos(videos: list[dict]) -> str:
    lines = []
    for v in sorted(videos, key=lambda x: x.get("views", 0), reverse=True):
        rate = 0
        if v.get("views", 0) > 0:
            rate = (v.get("likes", 0) + v.get("coins", 0) + v.get("favorites", 0) + v.get("shares", 0)) / v["views"] * 100
        lines.append(f"- 「{v['title']}」 views={v.get('views', 0):,} rate={rate:.1f}% tags={v.get('tags', '')}")
    return "\n".join(lines)

async def stream_analysis(client: AsyncOpenAI, model: str, messages: list[dict]):
    """Yield text chunks from AI streaming response."""
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
```

- [ ] **Step 2: Create AI SSE endpoint**

```python
# backend/app/api/ai.py
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from openai import AsyncOpenAI
from app.core.deps import get_db
from app.models import Query, QueryVideo, VideoStats, Video, AppSettings
from app.core.security import decrypt_value
from app.services.ai_analysis import build_analysis_prompt, stream_analysis

router = APIRouter()

@router.post("/queries/{query_id}/ai/analyze")
async def ai_analyze(query_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query or query.status != "done":
        raise HTTPException(status_code=400, detail="Query not ready")

    # Get AI settings
    base_url_row = await db.get(AppSettings, "ai_base_url")
    api_key_row = await db.get(AppSettings, "ai_api_key")
    model_row = await db.get(AppSettings, "ai_model")

    base_url = base_url_row.value if base_url_row else "https://api.openai.com/v1"
    api_key = ""
    if api_key_row and api_key_row.value:
        api_key = decrypt_value(api_key_row.value) if api_key_row.is_sensitive else api_key_row.value
    model = model_row.value if model_row else "gpt-4o"

    if not api_key:
        raise HTTPException(status_code=400, detail="AI API key not configured")

    # Gather video data
    result = await db.execute(
        select(Video, VideoStats)
        .join(QueryVideo, QueryVideo.bvid == Video.bvid)
        .join(VideoStats, VideoStats.bvid == Video.bvid)
        .where(QueryVideo.query_id == query_id)
    )
    rows = result.all()

    latest: dict[str, dict] = {}
    for video, stats in rows:
        if video.bvid not in latest or stats.fetched_at > latest[video.bvid].get("_fetched_at", stats.fetched_at):
            latest[video.bvid] = {
                "title": video.title, "tags": video.tags,
                "views": stats.views, "likes": stats.likes,
                "coins": stats.coins, "favorites": stats.favorites,
                "shares": stats.shares, "_fetched_at": stats.fetched_at,
            }

    videos_data = list(latest.values())
    summary = {
        "video_count": query.video_count, "total_views": query.total_views,
        "total_likes": query.total_likes, "total_coins": query.total_coins,
        "total_favorites": query.total_favorites,
    }

    # Detect language from Accept-Language header
    lang = "zh"
    accept_lang = request.headers.get("Accept-Language", "")
    if accept_lang.startswith("en"):
        lang = "en"

    messages = build_analysis_prompt(videos_data, summary, lang)

    client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def event_generator():
        try:
            async for chunk in stream_analysis(client, model, messages):
                yield {"event": "message", "data": json.dumps({"content": chunk})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())
```

- [ ] **Step 3: Register in main.py**

```python
from app.api import fetch, queries, videos, analytics, ai
app.include_router(ai.router, prefix="/api", tags=["ai"])
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/ai_analysis.py backend/app/api/ai.py backend/app/main.py
git commit -m "feat: add AI analysis service with SSE streaming"
```

---

### Task 15: Settings API endpoints

**Files:**
- Create: `backend/app/api/settings.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create settings endpoints**

```python
# backend/app/api/settings.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.models import AppSettings
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.core.security import encrypt_value, decrypt_value

router = APIRouter()

SENSITIVE_KEYS = {"ai_api_key", "sessdata"}
MASK = "***"

DEFAULTS = {
    "sessdata": "",
    "ai_base_url": "https://api.openai.com/v1",
    "ai_api_key": "",
    "ai_model": "gpt-4o",
}

async def _get_setting(db: AsyncSession, key: str) -> str:
    row = await db.get(AppSettings, key)
    if not row:
        return DEFAULTS.get(key, "")
    if row.is_sensitive and row.value:
        return MASK
    return row.value

async def _set_setting(db: AsyncSession, key: str, value: str):
    if value == MASK:
        return  # Skip masked values
    is_sensitive = key in SENSITIVE_KEYS
    row = await db.get(AppSettings, key)
    if row:
        row.value = encrypt_value(value) if is_sensitive and value else value
        row.is_sensitive = is_sensitive
    else:
        db.add(AppSettings(
            key=key,
            value=encrypt_value(value) if is_sensitive and value else value,
            is_sensitive=is_sensitive,
        ))

@router.get("/settings", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    return SettingsResponse(
        sessdata=await _get_setting(db, "sessdata"),
        ai_base_url=await _get_setting(db, "ai_base_url"),
        ai_api_key=await _get_setting(db, "ai_api_key"),
        ai_model=await _get_setting(db, "ai_model"),
    )

@router.put("/settings", response_model=SettingsResponse)
async def update_settings(data: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    if data.sessdata is not None:
        await _set_setting(db, "sessdata", data.sessdata)
    if data.ai_base_url is not None:
        await _set_setting(db, "ai_base_url", data.ai_base_url)
    if data.ai_api_key is not None:
        await _set_setting(db, "ai_api_key", data.ai_api_key)
    if data.ai_model is not None:
        await _set_setting(db, "ai_model", data.ai_model)
    await db.commit()
    return await get_settings(db)

@router.post("/settings/test-ai")
async def test_ai_connection(db: AsyncSession = Depends(get_db)):
    from openai import AsyncOpenAI
    row_url = await db.get(AppSettings, "ai_base_url")
    row_key = await db.get(AppSettings, "ai_api_key")
    row_model = await db.get(AppSettings, "ai_model")

    base_url = row_url.value if row_url else DEFAULTS["ai_base_url"]
    api_key = ""
    if row_key and row_key.value and row_key.is_sensitive:
        api_key = decrypt_value(row_key.value)
    elif row_key:
        api_key = row_key.value
    model = row_model.value if row_model else DEFAULTS["ai_model"]

    if not api_key:
        return {"status": "error", "message": "API key not configured"}

    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        resp = await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "Say OK"}], max_tokens=5
        )
        return {"status": "ok", "model": model}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

- [ ] **Step 2: Register in main.py**

```python
from app.api import fetch, queries, videos, analytics, ai, settings as settings_api
app.include_router(settings_api.router, prefix="/api", tags=["settings"])
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/settings.py backend/app/main.py
git commit -m "feat: add settings CRUD with encryption and AI test"
```

---

## Phase 4: Frontend Scaffolding

### Task 16: Initialize frontend project

**Files:**
- Create: `frontend/package.json` (via Vite CLI)
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Scaffold Vite + React + TypeScript**

Run: `cd frontend && npm create vite@latest . -- --template react-ts`
If directory is not empty, confirm overwrite.

- [ ] **Step 2: Install core dependencies**

Run: `cd frontend && npm install react-router-dom echarts echarts-for-react i18next react-i18next`

- [ ] **Step 3: Install Shadcn/ui**

Run:
```bash
cd frontend
npx shadcn@latest init
```
Select: TypeScript, Default style, Tailwind CSS, src/components/ui path.

- [ ] **Step 4: Add commonly needed Shadcn components**

Run:
```bash
cd frontend
npx shadcn@latest add button card dialog input label select separator sheet tabs toggle-group badge dropdown-menu scroll-area tooltip
```

- [ ] **Step 5: Verify dev server starts**

Run: `cd frontend && npm run dev`
Expected: Vite dev server on http://localhost:5173

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore: initialize frontend with Vite, React, Shadcn, ECharts"
```

---

### Task 17: TypeScript types, i18n, theme, and utilities

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/i18n/index.ts`
- Create: `frontend/src/i18n/locales/zh.json`
- Create: `frontend/src/i18n/locales/en.json`
- Create: `frontend/src/hooks/useTheme.ts`
- Create: `frontend/src/lib/utils.ts` (extend existing)
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Create TypeScript interfaces**

```typescript
// frontend/src/types/index.ts
export interface QuerySummary {
  id: number; uid: number; user_name: string | null;
  start_date: string; end_date: string; status: string;
  progress: string | null; video_count: number; total_views: number;
  created_at: string;
}

export interface QueryDetail extends QuerySummary {
  error_message: string | null;
  total_likes: number; total_coins: number; total_favorites: number;
  total_shares: number; total_danmaku: number; total_comments: number;
}

export interface VideoStats {
  views: number; likes: number; coins: number; favorites: number;
  shares: number; danmaku_count: number; comment_count: number;
  interaction_rate: number;
}

export interface VideoSummary {
  bvid: string; title: string; cover_url: string | null;
  duration: number; published_at: string | null;
  tags: string | null; stats: VideoStats;
}

export interface VideoDetail extends VideoSummary {
  aid: number | null; cid: number | null;
  description: string | null;
  has_danmaku: boolean; has_subtitle: boolean;
}

export interface PaginatedVideos {
  items: VideoSummary[]; total: number;
  page: number; page_size: number; total_pages: number;
}

export interface StatsSummary {
  total_views: number; total_likes: number; total_coins: number;
  total_favorites: number; total_shares: number; total_danmaku: number;
  total_comments: number; video_count: number;
}

export interface TrendPoint { date: string; views: number; }
export interface InteractionData { likes: number; coins: number; favorites: number; shares: number; }
export interface VideoComparison {
  metrics: string[]; video_values: number[];
  average_values: number[]; percentage_diff: number[];
}

export interface SettingsResponse {
  sessdata: string; ai_base_url: string;
  ai_api_key: string; ai_model: string;
}
```

- [ ] **Step 2: Create i18n config and translation files**

Create `frontend/src/i18n/index.ts`, `frontend/src/i18n/locales/zh.json`, and `frontend/src/i18n/locales/en.json` with all UI strings (sidebar labels, stat names, button text, page titles, settings labels). Chinese is the default locale.

- [ ] **Step 3: Create theme hook**

```typescript
// frontend/src/hooks/useTheme.ts
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "system"
  );

  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: Theme) => {
      if (t === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", isDark);
      } else {
        root.classList.toggle("dark", t === "dark");
      }
    };
    apply(theme);
    localStorage.setItem("theme", theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return { theme, setTheme };
}
```

- [ ] **Step 4: Create API client**

```typescript
// frontend/src/lib/api.ts
const BASE = import.meta.env.VITE_API_BASE || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

export const api = {
  fetch: (uid: number, start_date: string, end_date: string) =>
    request<{ query_id: number; status: string }>("/fetch", {
      method: "POST", body: JSON.stringify({ uid, start_date, end_date }),
    }),
  getQueries: () => request<QuerySummary[]>("/queries"),
  getQuery: (id: number) => request<QueryDetail>(`/queries/${id}`),
  deleteQuery: (id: number) => request(`/queries/${id}`, { method: "DELETE" }),
  getVideos: (queryId: number, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<PaginatedVideos>(`/queries/${queryId}/videos?${qs}`);
  },
  getVideo: (bvid: string) => request<VideoDetail>(`/videos/${bvid}`),
  getStatsSummary: (queryId: number) => request<StatsSummary>(`/queries/${queryId}/stats/summary`),
  getTrend: (queryId: number) => request<TrendPoint[]>(`/queries/${queryId}/stats/trend`),
  getInteraction: (queryId: number) => request<InteractionData>(`/queries/${queryId}/stats/interaction`),
  getComparison: (bvid: string, queryId: number) =>
    request<VideoComparison>(`/videos/${bvid}/stats/comparison?query_id=${queryId}`),
  getSettings: () => request<SettingsResponse>("/settings"),
  updateSettings: (data: Partial<SettingsResponse>) =>
    request<SettingsResponse>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  testAi: () => request<{ status: string; message?: string }>("/settings/test-ai", { method: "POST" }),
  wordcloudUrl: (queryId: number, type: string) => `${BASE}/queries/${queryId}/wordcloud/${type}`,
  videoWordcloudUrl: (bvid: string, type: string) => `${BASE}/videos/${bvid}/wordcloud/${type}`,
  aiAnalyzeUrl: (queryId: number) => `${BASE}/queries/${queryId}/ai/analyze`,
};
```

Import types at the top of api.ts.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/ frontend/src/i18n/ frontend/src/hooks/ frontend/src/lib/
git commit -m "feat: add types, i18n, theme hook, and API client"
```

---

### Task 18: App layout (Sidebar + TopBar + Router)

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/TopBar.tsx`
- Create: `frontend/src/components/layout/AppLayout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Sidebar component**

Sidebar shows: BiliAnalyzer logo, "+ New Query" button, scrollable query history list (each item shows UID, date range, video count + views), settings gear and language toggle at bottom. Active query highlighted with blue border.

- [ ] **Step 2: Create TopBar component**

TopBar shows: page title / query info on left, AI Analysis button (purple gradient, only on dashboard), theme toggle (sun/moon) on right.

- [ ] **Step 3: Create AppLayout component**

Flex layout: fixed Sidebar (220px) on left, main content area (flex-1, overflow-y-auto) with TopBar at top.

- [ ] **Step 4: Set up React Router in App.tsx**

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import VideoDetail from "./pages/VideoDetail";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:queryId" element={<Dashboard />} />
          <Route path="/video/:bvid" element={<VideoDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Verify layout renders**

Run: `cd frontend && npm run dev`
Expected: Sidebar visible on left, main content area on right.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add app layout with sidebar, topbar, and routing"
```

---

## Phase 5: Frontend Pages

### Task 19: New Query Dialog

**Files:**
- Create: `frontend/src/components/dashboard/NewQueryDialog.tsx`

- [ ] **Step 1: Build New Query Dialog**

Modal dialog with: UID number input, preset time range buttons (Last 7 days, 30 days, 3 months, 6 months, 1 year, All time), custom date range pickers (start + end), Fetch Data / Cancel buttons. Presets auto-fill date pickers. On submit: call `api.fetch()`, close dialog, add to query list.

- [ ] **Step 2: Integrate into Sidebar**

Wire "+ New Query" button to open the dialog.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/NewQueryDialog.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add new query dialog with date presets"
```

---

### Task 20: Dashboard page — Stats and Charts

**Files:**
- Create: `frontend/src/components/dashboard/StatsCards.tsx`
- Create: `frontend/src/components/dashboard/ViewsTrendChart.tsx`
- Create: `frontend/src/components/dashboard/InteractionChart.tsx`
- Create: `frontend/src/components/dashboard/ScatterChart.tsx`
- Create: `frontend/src/components/dashboard/WordCloudGrid.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create StatsCards (8 summary cards in 2 rows)**

Display: Total Views, Likes, Coins, Favorites, Shares, Danmaku, Comments, Video Count. Each card shows label and large formatted number. Use Shadcn Card. Responsive grid: 4 columns on desktop, 2 on mobile.

- [ ] **Step 2: Create ViewsTrendChart**

ECharts bar/line chart. X-axis: months, Y-axis: views. Fetches from `/api/queries/{id}/stats/trend`. Supports dark theme.

- [ ] **Step 3: Create InteractionChart**

ECharts bar chart comparing likes, coins, favorites, shares. Fetches from `/api/queries/{id}/stats/interaction`.

- [ ] **Step 4: Create ScatterChart**

ECharts scatter plot. Each dot is a video. X-axis: views, Y-axis: interaction rate. Fetches from video list data.

- [ ] **Step 5: Create WordCloudGrid**

2x2 grid of word cloud images. Each loads from `/api/queries/{id}/wordcloud/{type}`. Shows placeholder when loading or no data. Types: title, tag, danmaku, comment.

- [ ] **Step 6: Compose Dashboard page**

Wire all components into `Dashboard.tsx`. Fetch query detail on mount (using `queryId` from URL params or sidebar selection). Show loading state while query is `pending`/`fetching`. Show error state on `error`. Show stats + charts + word clouds on `done`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/pages/Dashboard.tsx
git commit -m "feat: add dashboard with stats cards, charts, and word clouds"
```

---

### Task 21: Dashboard — Video List and AI Panel

**Files:**
- Create: `frontend/src/components/dashboard/VideoList.tsx`
- Create: `frontend/src/components/dashboard/AIPanel.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create VideoList**

Sortable, paginated video list. Each row: cover thumbnail (100x62), title, stats (views, likes, coins, favs), tags, publish date, arrow indicator. Sort dropdown (views, likes, coins, favorites, shares, danmaku, comments, published_at) with asc/desc toggle. Pagination controls. Click navigates to `/video/{bvid}?query={queryId}`.

- [ ] **Step 2: Create AIPanel**

Shadcn Sheet (slide-over from right). Header: AI icon, "AI Analysis", query context, close button. Body: streams response from SSE endpoint, renders Markdown. "Regenerate" button at bottom. Uses `EventSource` to connect to `/api/queries/{id}/ai/analyze` via POST (use fetch + ReadableStream since SSE POST isn't standard EventSource).

- [ ] **Step 3: Integrate into Dashboard**

Add VideoList below word clouds. Wire AI Analysis button in TopBar to open AIPanel.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/pages/Dashboard.tsx
git commit -m "feat: add video list and AI analysis slide-over panel"
```

---

### Task 22: Video Detail page

**Files:**
- Create: `frontend/src/components/video/VideoHeader.tsx`
- Create: `frontend/src/components/video/VideoStatsCards.tsx`
- Create: `frontend/src/components/video/RadarChart.tsx`
- Create: `frontend/src/components/video/ComparisonBars.tsx`
- Create: `frontend/src/components/video/VideoWordClouds.tsx`
- Modify: `frontend/src/pages/VideoDetail.tsx`

- [ ] **Step 1: Create VideoHeader**

Cover image (200x125, with duration badge), title (h1), description snippet, publish date, BV ID, tags as colored badges, "Open on Bilibili" external link.

- [ ] **Step 2: Create VideoStatsCards**

8 stat cards: Views, Likes, Coins, Favorites, Shares, Danmaku, Comments, Interaction Rate. Same style as dashboard stats but single-video data.

- [ ] **Step 3: Create RadarChart**

ECharts radar chart. 7 axes: views, likes, coins, favorites, shares, danmaku, comments. Two series: this video (solid fill) and query average (dashed outline). Fetches from `/api/videos/{bvid}/stats/comparison?query_id={id}`.

- [ ] **Step 4: Create ComparisonBars**

Horizontal progress bars for each metric showing percentage difference vs average. Green for above average, red for below. Uses data from same comparison endpoint.

- [ ] **Step 5: Create VideoWordClouds**

2 word cloud cards: Content (title + tags + subtitle), Interaction (danmaku + comments). Each loads from `/api/videos/{bvid}/wordcloud/{type}`.

- [ ] **Step 6: Compose VideoDetail page**

Back navigation ("← Back to Dashboard"), breadcrumb. Fetch video detail + comparison data. Lay out: header, stats, charts (radar + bars side by side), word clouds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/video/ frontend/src/pages/VideoDetail.tsx
git commit -m "feat: add video detail page with radar chart and comparison"
```

---

### Task 23: Settings page

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Build Settings page**

Four sections using Shadcn Card:

1. **Bilibili Connection**: SESSDATA password input with eye toggle, connection status badge, help text with instructions.
2. **AI Configuration**: Base URL input (default prefilled), API Key password input, Model name input, "Test Connection" button with status feedback.
3. **Appearance**: Theme radio group (Light/Dark/System), Language radio group (中文/English).
4. **Data Management**: "Clear All Data" button with confirmation dialog, "Export Data" button (optional/placeholder).

Save button at bottom. Calls `api.updateSettings()`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: add settings page with bilibili, AI, and appearance config"
```

---

## Phase 6: Docker Deployment

### Task 24: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Create backend Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for wordcloud + CJK font
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-wqy-microhei gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "chore: add backend Dockerfile"
```

---

### Task 25: Frontend Dockerfile and Nginx config

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Create nginx.conf**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;  # Required for SSE
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Create frontend Dockerfile**

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf
git commit -m "chore: add frontend Dockerfile and Nginx config"
```

---

### Task 26: Docker Compose and final configuration

**Files:**
- Create: `docker-compose.yml`
- Modify: `.gitignore`
- Create: `.env.example` (root level)

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite+aiosqlite:///./data/bilianalyzer.db
    env_file:
      - .env
```

- [ ] **Step 2: Update .gitignore**

```
.claude/
.superpowers/
data/
node_modules/
dist/
__pycache__/
*.pyc
.env
.secret_key
```

- [ ] **Step 3: Create root .env.example**

```bash
DATABASE_URL=sqlite+aiosqlite:///./data/bilianalyzer.db
SECRET_KEY=
CORS_ORIGINS=
```

- [ ] **Step 4: Verify Docker build**

Run: `docker compose build`
Expected: Both images build successfully.

- [ ] **Step 5: Verify Docker run**

Run: `docker compose up`
Expected: Frontend on http://localhost:80, Backend on http://localhost:8000, API proxied correctly.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .gitignore .env.example
git commit -m "chore: add Docker Compose and deployment configuration"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-6 | Backend core: project setup, config, database, models, schemas, FastAPI app |
| 2 | 7-8 | Bilibili API client: WBI signature, data fetching methods |
| 3 | 9-15 | Backend API: fetch task, queries, videos, analytics, word clouds, AI, settings |
| 4 | 16-17 | Frontend scaffolding: Vite, Shadcn, types, i18n, theme, API client |
| 5 | 18-23 | Frontend pages: layout, dashboard, video detail, settings |
| 6 | 24-26 | Docker: Dockerfiles, Nginx, docker-compose |

**Total: 26 tasks across 6 phases.**
