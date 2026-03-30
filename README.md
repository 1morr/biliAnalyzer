# BiliAnalyzer

Bilibili 视频数据分析仪表板。输入 UP 主 UID 和时间段，获取视频数据并进行可视化分析，支持 AI 内容策略分析。

## 功能

- 输入 Bilibili UID + 时间段，抓取该时间段内所有视频数据
- 总览统计：播放量、点赞、投币、收藏、分享、弹幕、评论
- 可视化图表：播放量趋势、互动数据对比、播放量 vs 互动率散点图
- 词云：标题、标签、弹幕、评论
- 视频详情页：单个视频数据 + 雷达图对比（vs 平均值）
- AI 分析：接入 OpenAI 兼容 API，分析最火内容、成功因素、改进建议
- 中文 / English 双语支持
- 深色 / 浅色模式
- Docker 一键部署

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vite + React 19 + TypeScript + Shadcn/ui + Tailwind CSS v4 + ECharts |
| 后端 | FastAPI + SQLAlchemy 2.0 (async) + aiosqlite + httpx |
| 词云 | jieba 分词 + wordcloud |
| AI | OpenAI SDK (SSE streaming) |
| 部署 | Docker Compose (Nginx + Uvicorn) |

---

## 快速开始

### 方式一：Docker Compose（推荐）

**前置要求：** Docker 和 Docker Compose

```bash
# 1. 克隆项目
git clone <repo-url> && cd biliAnalyzer

# 2. 创建环境变量文件
cp .env.example .env

# 3. 构建并启动
docker compose up --build -d

# 4. 访问
#    前端：http://localhost
#    后端 API：http://localhost:8000/docs
```

停止服务：

```bash
docker compose down
```

### 方式二：本地开发

**前置要求：**
- Python >= 3.11
- Node.js >= 20
- npm

#### 1. 启动后端

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 创建 .env（可选）
cp .env.example .env

# 启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端运行在 http://localhost:8000，API 文档在 http://localhost:8000/docs

#### 2. 启动前端

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端运行在 http://localhost:5173

> 开发模式下前端通过 Vite 代理或直接请求 `http://localhost:8000/api`。如需自定义后端地址，在 `frontend/.env` 中设置：
> ```
> VITE_API_BASE=http://localhost:8000/api
> ```

---

## 使用说明

### 1. 创建查询

1. 点击侧边栏的 **「+ 新建查询」**
2. 输入 Bilibili UP 主的 **UID**（在 UP 主主页 URL 中可以找到，如 `space.bilibili.com/546195` 中的 `546195`）
3. 选择时间段预设或自定义日期范围
4. 点击 **「获取数据」**

系统会在后台抓取该时间段内的所有视频数据，侧边栏会实时显示进度。

### 2. 查看数据

数据抓取完成后，仪表板显示：
- **统计卡片**：8 项汇总数据
- **图表**：播放量趋势、互动对比、播放量 vs 互动率
- **词云**：标题、标签、弹幕、评论关键词
- **视频列表**：可按各项数据排序，点击进入详情页

### 3. AI 分析

1. 进入 **设置页面**，配置 AI：
   - **Base URL**：OpenAI 兼容 API 地址（默认 `https://api.openai.com/v1`）
   - **API Key**：你的 API 密钥
   - **模型**：如 `gpt-4o`、`gpt-4o-mini` 等
2. 回到仪表板，点击 **「AI 分析」** 按钮
3. AI 会以流式方式返回分析结果

### 4. SESSDATA（可选）

配置 SESSDATA 可以启用弹幕和字幕抓取功能：

1. 在浏览器中登录 [bilibili.com](https://www.bilibili.com)
2. 打开开发者工具（F12）→ Application → Cookies → `bilibili.com`
3. 复制 `SESSDATA` 的值
4. 在 BiliAnalyzer 设置页面中粘贴

> 不配置 SESSDATA 也可以正常使用，只是无法获取弹幕和字幕数据。

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `sqlite+aiosqlite:///./data/bilianalyzer.db` |
| `SECRET_KEY` | Fernet 加密密钥（留空则自动生成） | 空 |
| `CORS_ORIGINS` | 允许的跨域来源 | `http://localhost:5173` |

---

## 项目结构

```
biliAnalyzer/
├── backend/
│   ├── app/
│   │   ├── api/            # API 路由 (fetch, queries, videos, analytics, ai, settings)
│   │   ├── core/           # 配置、数据库、安全、依赖注入
│   │   ├── models/         # SQLAlchemy 模型 (User, Video, Query, etc.)
│   │   ├── schemas/        # Pydantic 请求/响应模型
│   │   └── services/       # 业务逻辑 (bilibili API, 词云, AI, 抓取任务)
│   ├── tests/              # 后端测试
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React 组件 (layout, dashboard, video)
│   │   ├── pages/          # 页面 (Dashboard, VideoDetail, Settings)
│   │   ├── hooks/          # 自定义 Hooks (useTheme)
│   │   ├── i18n/           # 国际化 (中文/英文)
│   │   ├── lib/            # 工具函数 + API 客户端
│   │   └── types/          # TypeScript 类型定义
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/fetch` | 创建新查询并开始抓取 |
| GET | `/api/queries` | 获取查询历史列表 |
| GET | `/api/queries/{id}` | 获取查询详情 |
| DELETE | `/api/queries/{id}` | 删除查询及相关数据 |
| GET | `/api/queries/{id}/videos` | 获取视频列表（分页、排序） |
| GET | `/api/videos/{bvid}` | 获取单个视频详情 |
| GET | `/api/queries/{id}/stats/summary` | 获取统计汇总 |
| GET | `/api/queries/{id}/stats/trend` | 获取播放量趋势 |
| GET | `/api/queries/{id}/stats/interaction` | 获取互动数据 |
| GET | `/api/videos/{bvid}/stats/comparison` | 获取视频 vs 平均对比 |
| GET | `/api/queries/{id}/wordcloud/{type}` | 获取查询级词云图片 |
| GET | `/api/videos/{bvid}/wordcloud/{type}` | 获取视频级词云图片 |
| POST | `/api/queries/{id}/ai/analyze` | AI 分析（SSE 流式响应） |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| POST | `/api/settings/test-ai` | 测试 AI 连接 |

## License

MIT
