# BiliAnalyzer

A dashboard for reading a Bilibili creator's numbers: what they posted in a
window of time, how it performed, what the audience said about it, and what an
LLM makes of all three.

<p>
  <a href="https://github.com/1morr/biliAnalyzer/actions/workflows/ci.yml"><img src="https://github.com/1morr/biliAnalyzer/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/1morr/biliAnalyzer" alt="License: MIT"></a>
</p>

**English** · [繁體中文](README.zh-Hant.md)

Give it a UID and a date range. It fetches every video the creator posted in
that window, then charts the performance, tokenizes the titles, tags, subtitles,
danmaku and comments into drillable word tables, scores sentiment, and crosses
all of it against audience segments. An OpenAI-compatible endpoint can then be
asked questions about the result, with tool calls against the same data.

![Dashboard](docs/images/dashboard.png)

## Quick start

Requires Docker and Docker Compose.

```bash
git clone https://github.com/1morr/biliAnalyzer.git
cd biliAnalyzer
cp .env.example .env          # required — compose will not start without it
docker compose up --build -d
```

Then open **<http://localhost:8000>**. The API docs are at `/docs` on the same
port; the built frontend is served by the same process, so there is no separate
web port.

### See it with data, immediately

Scraping a real creator takes a while and needs a `SESSDATA` cookie. To fill
every panel with plausible data without one:

```bash
docker compose exec app python -m scripts.seed_demo
```

That seeds a fictional creator with a few months of videos, comments and
danmaku. Pass `--reset` to start over.

## Using it

1. **New query** — enter a creator's UID (the number in
   `space.bilibili.com/546195`) and pick a date range. The sidebar shows fetch
   progress.
2. **Dashboard** — summary tiles, view-count trend, interaction comparison,
   views-vs-engagement scatter, duration analysis, publish-hour density, and
   word tables you can click through to the underlying danmaku and comments.
   Audience segments (gender, membership, level, region) double as filter axes.
3. **Video detail** — one video's numbers with a radar chart and deltas against
   the query's own average.
4. **AI analysis** — configure an OpenAI-compatible Base URL, key and model in
   Settings, then ask follow-up questions; answers stream back.

**SESSDATA is required for scraping.** `x/web-interface/view`, which every
video goes through, answers HTTP 412 to requests without a logged-in session —
verified against the live API — so a run without it fails immediately rather
than degrading. To add it: log in to bilibili.com, F12 → Application → Cookies
→ copy `SESSDATA`, paste it into Settings. Use the demo seed above to look
around without one.

## Security

This is a **single-user local tool with no authentication**. Every endpoint is
open to whoever can reach the port, so Compose binds it to `127.0.0.1` only.
Do not publish the port to a network you do not control, and do not put it
behind a reverse proxy without adding auth first.

Your SESSDATA and API key are encrypted at rest with Fernet before they go into
SQLite, and the API returns them masked. The encryption key lives in
`DATA_DIR/.secret_key` — beside the database it protects, so this defends
against someone getting the `.db` file alone, not against host access.

## Tech stack

| Layer | |
|---|---|
| Frontend | Vite · React 19 · TypeScript · Tailwind CSS v4 · Base UI · ECharts |
| Backend | FastAPI · SQLAlchemy 2.0 (async) · aiosqlite · httpx |
| Chinese NLP | jieba (tokenizing) · SnowNLP (sentiment) |
| AI | OpenAI SDK, streamed over SSE, with tool calling |
| Deploy | Docker Compose, single multi-stage image |

## Configuration

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/bilianalyzer.db` | Where the database lives |
| `DATA_DIR` | `./data` | Holds the database and `.secret_key` |
| `SECRET_KEY` | *(generated)* | Fernet key. Generated on first run and persisted; set it explicitly to keep stored credentials readable across environments |
| `CORS_ORIGINS` | `http://localhost:5173` | Only needed for the split dev setup. Empty disables CORS entirely |

## Local development

```bash
# backend
cd backend && python -m venv .venv && .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --port 8000 --reload

# frontend, in another terminal
cd frontend && npm install && npm run dev      # http://localhost:5173
```

`pytest` from `backend/`, `npm run build` and `npx eslint .` from `frontend/`.
Requires Python 3.11+ and Node 20+.

## License

[MIT](LICENSE)
