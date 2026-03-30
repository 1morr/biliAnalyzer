# BiliAnalyzer — Design Specification

A Bilibili video analytics dashboard that helps creators understand why their videos succeed and how to improve.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 18 + TypeScript + Shadcn/ui + Tailwind CSS |
| Charts | ECharts (via echarts-for-react) |
| i18n | react-i18next (zh/en) |
| Backend | FastAPI + Python 3.11+ |
| ORM | SQLAlchemy 2.0 (async) + aiosqlite |
| HTTP Client | httpx (async) |
| Word Clouds | jieba (segmentation) + wordcloud (image generation) |
| AI | openai Python SDK (OpenAI-compatible endpoint) |
| Database | SQLite |
| Deployment | Docker Compose (Nginx + Uvicorn) |

## Architecture

Monolithic async backend. Single FastAPI server handles Bilibili data fetching, caching, word cloud generation, and AI analysis. Frontend is a static SPA served by Nginx in production.

```
Browser (React SPA)
    ↕ REST API (JSON)
FastAPI Backend
    ├── httpx → Bilibili API
    ├── jieba + wordcloud → PNG images
    ├── openai SDK → AI Provider
    └── SQLAlchemy → SQLite
```

Heavy operations (bulk video fetching) run as background tasks using `asyncio.create_task` tracked by an in-memory job registry. AI analysis streams directly via SSE. Note: background tasks run in the same process — acceptable for a single-user/small-team tool. For production scale, upgrade to Celery + Redis.

## Data Model

### User

| Column | Type | Description |
|--------|------|-------------|
| uid | INTEGER, PK | Bilibili user ID |
| name | TEXT | Username |
| avatar_url | TEXT | Avatar URL |
| last_fetched_at | DATETIME | Last sync time |

### Video

| Column | Type | Description |
|--------|------|-------------|
| bvid | TEXT, PK | Bilibili BV ID |
| aid | INTEGER | Bilibili AV ID (numeric, required for comments API) |
| cid | INTEGER | Content/part ID (required for danmaku and subtitle APIs) |
| uid | INTEGER, FK → User | Author UID |
| title | TEXT | Video title |
| description | TEXT | Video description |
| cover_url | TEXT | Cover image URL |
| duration | INTEGER | Duration in seconds |
| published_at | DATETIME | Publish time |
| tags | TEXT | Comma-separated tags |
| created_at | DATETIME | Record creation time |
| updated_at | DATETIME | Last data update |

### VideoStats

Snapshot of stats at fetch time. Separate from Video to track trends over time.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER, PK | Auto-increment |
| bvid | TEXT, FK → Video | Video BV ID |
| views | INTEGER | Play count |
| likes | INTEGER | Likes |
| coins | INTEGER | Coins |
| favorites | INTEGER | Favorites |
| shares | INTEGER | Shares |
| danmaku_count | INTEGER | Danmaku count |
| comment_count | INTEGER | Comment count |
| fetched_at | DATETIME | Snapshot timestamp |

### VideoContent

Text content stored separately (large, fetched less frequently).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER, PK | Auto-increment |
| bvid | TEXT, FK → Video | Video BV ID |
| danmakus | TEXT (JSON) | Array of danmaku texts |
| comments | TEXT (JSON) | Array of top comments |
| subtitle | TEXT | Subtitle text (if available) |
| fetched_at | DATETIME | Fetch timestamp |

### Query

Stores user query history.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER, PK | Auto-increment |
| uid | INTEGER | Queried Bilibili user UID (stored directly, not FK — user record may not exist yet) |
| user_name | TEXT | Cached username at query time |
| start_date | DATE | Query start date |
| end_date | DATE | Query end date |
| status | TEXT | Query status: `pending`, `fetching`, `fetching_content`, `done`, `error` |
| progress | TEXT | Progress info, e.g. "Fetching video 12/47" |
| error_message | TEXT | Error details if status is `error` |
| video_count | INTEGER | Number of videos found |
| total_views | INTEGER | Aggregated total views |
| total_likes | INTEGER | Aggregated total likes |
| total_coins | INTEGER | Aggregated total coins |
| total_favorites | INTEGER | Aggregated total favorites |
| total_shares | INTEGER | Aggregated total shares |
| total_danmaku | INTEGER | Aggregated total danmaku |
| total_comments | INTEGER | Aggregated total comments |
| created_at | DATETIME | Query creation time |

### QueryVideo

Join table linking queries to their videos. Enables cascade delete and multi-query video sharing.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER, PK | Auto-increment |
| query_id | INTEGER, FK → Query | Query ID |
| bvid | TEXT, FK → Video | Video BV ID |

Unique constraint on `(query_id, bvid)`. When a query is deleted, its `QueryVideo` rows are deleted. A Video record is deleted only when no remaining `QueryVideo` rows reference it (orphan cleanup).

### AppSettings

Key-value store for user configuration. Sensitive values (API key, SESSDATA) encrypted at rest using Fernet symmetric encryption (`cryptography` library). The encryption key is either:
- Provided via `SECRET_KEY` environment variable (used directly as Fernet key, must be a valid 32-byte URL-safe base64 string), OR
- Auto-generated on first run using `Fernet.generate_key()` and stored in `./data/.secret_key` (excluded from version control).

No PBKDF2 derivation is needed — Fernet keys are used directly. This is simple and secure for a single-instance deployment.

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT, PK | Setting key |
| value | TEXT | Setting value (Fernet-encrypted for keys: `ai_api_key`, `sessdata`) |
| is_sensitive | BOOLEAN | Whether the value is encrypted |

## API Endpoints

### Data Fetching

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/fetch` | Create a new query. Starts background data fetch. Returns query ID immediately. |
| GET | `/api/queries` | List all query history (for sidebar). |
| GET | `/api/queries/{id}` | Get query detail including status, progress, and video list. |
| DELETE | `/api/queries/{id}` | Delete a query. Cascades: deletes associated VideoStats and VideoContent rows. Video records shared by other queries are retained; orphaned Video records are cleaned up. |

**`POST /api/fetch` request body:**
```json
{
  "uid": 546195,
  "start_date": "2024-01-01",
  "end_date": "2024-06-30"
}
```

**`POST /api/fetch` response:**
```json
{
  "query_id": 1,
  "status": "pending"
}
```

**Fetch workflow (background task):**
1. Set query status to `fetching`. Fetch user info → create/update User record.
2. Paginate through video list API, filter by date range. For each video, call the video detail API (`/x/web-interface/view`) to get full metadata including `aid`, `cid`, tags, and stats. Create Video records, VideoStats snapshots, and QueryVideo associations. Update `progress` field ("Fetching video 12/47").
3. Set status to `fetching_content`. For each video, fetch comments (public). If SESSDATA is configured, fetch danmaku (XML parse) and subtitle (two-step: get subtitle URL from player API, then fetch JSON from CDN). Create VideoContent records.
4. Compute aggregate stats, update Query totals. Set status to `done`.
5. On any error: set status to `error`, store `error_message`.

### Videos

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/queries/{id}/videos` | List videos for a query. Supports `sort_by` (views, likes, coins, favorites, shares, danmaku, comments, published_at) and `order` (asc, desc). Paginated: `page` (default 1), `page_size` (default 20, max 100). |
| GET | `/api/videos/{bvid}` | Single video detail with latest stats. |

**Pagination response envelope:**
```json
{
  "items": [...],
  "total": 47,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/queries/{id}/stats/summary` | Aggregated stats for a query (total views, likes, etc.). |
| GET | `/api/queries/{id}/stats/trend` | Views trend over time (grouped by day/week/month). |
| GET | `/api/queries/{id}/stats/interaction` | Interaction comparison data (likes, coins, favorites, shares). |
| GET | `/api/queries/{id}/wordcloud/{type}` | Word cloud image (PNG). Types: `title`, `tag`, `danmaku`, `comment`. Generated on first request, cached to `./data/wordclouds/{query_id}_{type}.png`. Cache invalidated if query data is re-fetched. |
| GET | `/api/videos/{bvid}/stats/comparison` | Single video stats vs query average (for radar chart). Requires `query_id` query param for context. |
| GET | `/api/videos/{bvid}/wordcloud/{type}` | Single video word cloud. Types: `content` (title + tags + subtitle combined), `interaction` (danmaku + comments combined). Cached to `./data/wordclouds/{bvid}_{type}.png`. |

**Interaction Rate formula:** `(likes + coins + favorites + shares) / views * 100`. Computed in API response, not stored. Returned as a float percentage in video detail and stats endpoints.

### AI Analysis

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/queries/{id}/ai/analyze` | Trigger AI analysis for entire query. Streams response (SSE). |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get all settings. Sensitive values returned as masked strings (`"***"`). |
| PUT | `/api/settings` | Update settings. Backend detects masked placeholder values (`"***"`) and skips those keys — only non-masked values are updated. Supports partial updates. |
| POST | `/api/settings/test-ai` | Test AI connection. |

## Frontend Pages

### Layout

- **Left sidebar** (fixed, 220px): App logo, "+ New Query" button, query history list, settings gear icon, language toggle.
- **Main content area**: Scrollable, displays the active page.
- **Dark/light mode toggle**: In the top bar of the main content area. Supports light, dark, and system preference.

### Page 1: Dashboard (Query Detail)

Displays when a query is selected from the sidebar.

**Top bar:**
- Query info: UID, date range, video count
- "✦ AI Analysis" button (purple gradient) — opens slide-over panel
- Dark/light mode toggle

**Content (scrolls vertically):**

1. **Summary stats** — 8 cards in 2 rows of 4:
   - Row 1: Total Views, Total Likes, Total Coins, Total Favorites
   - Row 2: Total Shares, Total Danmaku, Total Comments, Video Count

2. **Charts** — 2 columns:
   - Left: Views Trend (bar/line chart, grouped by time)
   - Right: Interaction Comparison (bar chart: likes, coins, favorites, shares)

3. **Views vs Interaction Rate** + **Word Clouds** — 2 columns:
   - Left: Scatter plot (each video as a dot, x=views, y=interaction rate)
   - Right: 4 word clouds in 2×2 grid (Title, Tag, Danmaku, Comment)

4. **Video List** — Sortable table/cards:
   - Each row: cover thumbnail, title, key stats (views, likes, coins, favorites), tags, publish date
   - Sort dropdown: views, likes, coins, favorites, shares, danmaku, comments, published date
   - Order toggle: ascending/descending
   - Click to navigate to Video Detail page
   - Paginated

**AI Analysis slide-over panel (from right):**
- Header: AI icon, "AI Analysis", query context
- Close button
- Content sections: Top Performers, Why They Work, Recommendations, Areas to Improve
- "Regenerate" button at bottom
- Streams response from SSE endpoint

### Page 2: Video Detail

Reached by clicking a video from the dashboard list.

**Top bar:**
- "← Back to Dashboard" breadcrumb
- Query context breadcrumb
- Dark/light mode toggle

**Content:**

1. **Video header**: Cover image (with duration badge), title, description snippet, publish date, BV ID, tags as badges, "Open on Bilibili" link.

2. **Stats** — 8 cards in 2 rows of 4:
   - Row 1: Views, Likes, Coins, Favorites
   - Row 2: Shares, Danmaku, Comments, Interaction Rate

3. **Charts** — 2 columns:
   - Left: Radar chart — this video's metrics vs query average (axes: views, likes, coins, favorites, shares, danmaku, comments)
   - Right: "This Video vs Average" — horizontal progress bars showing percentage difference for each metric

4. **Word Clouds** — 2 cards:
   - Content Word Cloud: title keywords + tags + subtitle combined
   - Interaction Word Cloud: danmaku + comments combined

### Page 3: Settings

Accessed via gear icon in sidebar footer.

**Sections:**

1. **Bilibili Connection**
   - SESSDATA input (password type, toggle visibility)
   - Connection status indicator (connected / not connected / expired)
   - Help text: how to get SESSDATA from browser

2. **AI Configuration**
   - Base URL input (default: `https://api.openai.com/v1`)
   - API Key input (password type)
   - Model name input (default: `gpt-4o`)
   - "Test Connection" button

3. **Appearance**
   - Theme: Light / Dark / System (radio group)
   - Language: 中文 / English (radio group)

4. **Data Management**
   - Clear all cached data button (with confirmation)
   - Export data button (optional, exports query data as JSON)

### New Query Dialog

Modal triggered by "+ New Query" button.

- **UID input**: Text field for Bilibili user ID
- **Time range presets**: Button group — Last 7 days, Last 30 days, Last 3 months, Last 6 months, Last year, All time
- **Custom date picker**: Two date pickers (start, end) with calendar widget
- **Fetch Data** / **Cancel** buttons
- Preset selection auto-fills the date pickers; custom dates override preset selection

## Bilibili API Integration

### WBI Signature (Required)

Bilibili's WBI-signed endpoints require a signature computed from `img_key` and `sub_key`. The flow:
1. Fetch `https://api.bilibili.com/x/web-interface/nav` to get `wbi_img.img_url` and `wbi_img.sub_url`.
2. Extract `img_key` and `sub_key` from the URLs (filename without extension).
3. For each WBI request: sort query params, append `wts` (current timestamp), compute `w_rid = MD5(encoded_params + mixin_key)`, append both to the request.
4. Cache `img_key`/`sub_key` for the session (they rotate infrequently).

Implementation reference: the bilibili-API-collect community docs.

### Public endpoints (no auth, WBI-signed where noted)

- User info: `https://api.bilibili.com/x/space/wbi/acc/info?mid={uid}` (WBI signed)
- Video list: `https://api.bilibili.com/x/space/wbi/arc/search?mid={uid}&ps=50&pn={page}` (WBI signed)
- Video detail (stats + cid + aid): `https://api.bilibili.com/x/web-interface/view?bvid={bvid}` (no WBI)
- Tags: included in video detail response
- Comments: `https://api.bilibili.com/x/v2/reply?type=1&oid={aid}&pn={page}` (no WBI, uses `aid` numeric ID)

### Authenticated endpoints (require SESSDATA cookie)

- Danmaku: `https://comment.bilibili.com/{cid}.xml` (returns XML, parse to extract danmaku text)
- Danmaku (alternative, protobuf): `https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid={cid}&segment_index={n}` (paginated segments)
- Subtitle: Two-step process:
  1. `https://api.bilibili.com/x/player/v2?bvid={bvid}&cid={cid}` → response contains `subtitle.subtitles[].subtitle_url`
  2. Fetch the `subtitle_url` (CDN JSON) → extract text from `body[].content`

### Graceful degradation

When SESSDATA is not configured, danmaku and subtitle features show a notice prompting the user to add SESSDATA in settings. Word clouds that depend on danmaku/subtitle data display a placeholder. All other features work normally.

### Rate limiting

Backend implements request throttling (1 request/second to Bilibili API) to avoid being blocked. Bulk fetches use sequential requests with delays. An async semaphore limits concurrency to 1 Bilibili request at a time.

## AI Analysis

**Data sent to AI:** Aggregated summary of all videos in the query — title list, tag frequency, top danmaku keywords, top comment keywords, per-video stats, overall stats, best/worst performing videos.

**Prompt structure:** System prompt instructs the AI to analyze as a Bilibili content strategist. Includes structured data. Asks for: top performers analysis, success factors, actionable recommendations, areas for improvement.

**Streaming:** Uses Server-Sent Events (SSE) to stream the AI response to the frontend in real-time.

**Language:** AI prompt adapts to the user's selected language (zh/en).

**Scope:** AI analysis is query-level only (analyzes all videos in a query). There is no per-video AI analysis — the Video Detail page provides statistical comparisons (radar chart, vs-average bars) which are sufficient for individual video insights without AI cost.

## Internationalization

Two locales: `zh` (Chinese, default) and `en` (English).

Translation files in `frontend/src/i18n/locales/{zh,en}.json`. All user-facing strings externalized. Language preference stored in `localStorage` only (no server-side storage needed — the frontend is the sole consumer).

Backend error messages support i18n via `Accept-Language` header sent by the frontend.

## Dark/Light Mode

Implemented via Shadcn/Tailwind CSS dark mode (`class` strategy). Three options: light, dark, system. Preference stored in `localStorage` only.

ECharts theme switches between light and dark chart themes.

## CORS Configuration

- **Development**: FastAPI CORS middleware allows `http://localhost:5173` (Vite dev server). Configured via `CORS_ORIGINS` environment variable.
- **Production (Docker)**: Nginx proxies `/api/*` to backend on the same origin — no CORS needed. `CORS_ORIGINS` defaults to empty (disabled).

## Docker Deployment

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    # Nginx serves static files + proxies /api to backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data  # SQLite + word cloud cache
    environment:
      - DATABASE_URL=sqlite+aiosqlite:///./data/bilianalyzer.db
```

**Frontend Dockerfile:** Multi-stage build (Node for build, Nginx for serve). Nginx config proxies `/api/*` to backend service.

**Backend Dockerfile:** Python 3.11 slim image. Installs dependencies, runs Uvicorn.

**Volumes:** `./data` directory persists SQLite database, generated word cloud images, encryption key, and any cached data across container restarts.

**Environment variables (`.env.example`):**
```bash
# Required
DATABASE_URL=sqlite+aiosqlite:///./data/bilianalyzer.db

# Optional — Fernet encryption key (32-byte URL-safe base64). If not set, auto-generated and stored in ./data/.secret_key
SECRET_KEY=

# Optional — CORS origins for development (comma-separated). Empty = disabled.
CORS_ORIGINS=http://localhost:5173
```

## Project Structure

```
biliAnalyzer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn components
│   │   │   ├── charts/          # ECharts wrapper components
│   │   │   ├── layout/          # Sidebar, TopBar, ThemeToggle
│   │   │   └── dashboard/       # Dashboard-specific components
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Query detail / main dashboard
│   │   │   ├── VideoDetail.tsx  # Single video analysis
│   │   │   └── Settings.tsx     # Configuration page
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client (fetch wrappers)
│   │   ├── i18n/
│   │   │   ├── index.ts         # i18next config
│   │   │   └── locales/
│   │   │       ├── zh.json
│   │   │       └── en.json
│   │   ├── types/               # TypeScript interfaces
│   │   ├── lib/                 # Utilities (cn, formatNumber, etc.)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── nginx.conf
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fetch.py         # POST /api/fetch
│   │   │   ├── queries.py       # Query CRUD + video listing
│   │   │   ├── videos.py        # Single video endpoints
│   │   │   ├── analytics.py     # Stats, trends, word clouds
│   │   │   ├── ai.py            # AI analysis (SSE)
│   │   │   └── settings.py      # Settings CRUD
│   │   ├── services/
│   │   │   ├── bilibili.py      # Bilibili API client
│   │   │   ├── wordcloud.py     # jieba segmentation + wordcloud generation
│   │   │   └── ai_analysis.py   # AI prompt construction + streaming
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── video.py
│   │   │   ├── query.py
│   │   │   └── settings.py
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── core/
│   │   │   ├── config.py        # App configuration
│   │   │   ├── database.py      # Database engine + session
│   │   │   ├── security.py      # Encryption for sensitive settings
│   │   │   └── deps.py          # FastAPI dependencies
│   │   └── main.py              # FastAPI app, CORS, router mounting
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml
├── docker-compose.yml
├── .env.example
├── .gitignore
└── docs/
```
