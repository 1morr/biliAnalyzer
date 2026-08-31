# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

三類人共用同一個介面，這是產品的核心張力：

- **好奇的觀眾** —— 想知道「這個 UP 主到底多紅」「大家在彈幕裡都在喊什麼」。不懂互動率是什麼，需要一眼看懂的結論。
- **自己分析自己頻道的 UP 主** —— 反覆回看同一組數據，關心「為什麼這支爆了」「下一支該拍什麼」「觀眾情緒往哪走」。需要能鑽到單支影片、單個詞、單則評論的深度。
- **營運／研究者** —— 追多個 UID、比較時間段、探索受眾畫像與情感分佈。需要密度與可掃描性。

同一畫面必須同時對非專業者可讀、對創作者夠深。做法是漸進揭露，不是折衷成中庸密度。

## Product Purpose

輸入一個 Bilibili UP 主的 UID 與時間段，抓取該區間所有影片的完整數據（播放／點讚／投幣／收藏／分享／彈幕／評論／字幕），做視覺化分析，並可接 OpenAI 相容 API 做 AI 內容策略對話。

成功 = 使用者看完儀表板後，能說出一句關於這個頻道的、具體的、原本不知道的話。

## Positioning

不是「B 站數據面板」的又一個複製品，而是一台**分析儀器**：

- 抓的不只是計數器，還有彈幕、評論、字幕**文本**與**留言者身份**（性別／等級／大會員／地區）——因此能回答「誰在看」與「他們在說什麼」，而不只是「多少人看」。
- 情感分析 × 受眾維度交叉（`DemographicSentimentMatrix`）是一般看板做不到的：可以問「大會員觀眾對這批內容的情緒是不是比路人正面」。
- 詞雲不是裝飾，可點擊下鑽到該詞出現的原始彈幕／評論片段（`WordDetailPanel`）。
- AI 分析有工具呼叫（`ai_tools.py`），能真的去查數據回答追問，而非對摘要瞎編。

**視覺定位（使用者確認）**：專業分析工具，擁有自己的身分，不沿用 B 站的識別色與社群氣質。資料來自 B 站是事實，不是外觀依據。

## Operating Context

- 自架／本機執行（Docker Compose 或 `vite dev` + `uvicorn`），單人使用、無帳號系統。
- 抓取是長時任務：建立查詢後後端背景抓取，前端每 3 秒輪詢 `status`（`fetching` / `fetching_content` / `done` / `error`）與 `progress` 文字。**等待狀態是產品的常態畫面之一，不是邊緣情況。**
- 情感分析是獨立的第二段非同步任務（`sentiment_status`），可能在主數據完成後仍在跑。
- SESSDATA 未設定時，彈幕／評論／字幕抓不到 —— 大半個介面會空著。**這是最常見的首次使用狀態。**
- AI 未設定時，AI 入口不該假裝可用。
- 桌機為主，寬螢幕長時間閱讀；但行動裝置需可用（目前 `AppLayout` 用 `h-screen` + 固定 220px 側欄，行動裝置實質不可用）。

## Capabilities and Constraints

- **既有技術棧不變**：Vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui（Base UI 底層）+ ECharts 6 + react-i18next + react-router-dom 7。後端 FastAPI + SQLAlchemy async + SQLite。
- 路由：`/dashboard`、`/dashboard/:queryId`、`/video/:bvid`、`/settings`。
- 雙語：`zh`（**簡體中文**，介面既有語料）與 `en`，切換存 localStorage。所有新文案必須進 i18n。
- 深色／淺色主題（`useTheme`，`.dark` class）—— 兩者都是一等公民。
- 圖表一律 ECharts（含 `echarts-wordcloud`），主題必須跟隨明暗色與設計 token，不可硬寫顏色。
- 封面圖來自 B 站 CDN，需 `referrerPolicy="no-referrer"`；可能載入失敗，需有 fallback。
- 數字量級跨度極大（個位數到千萬），格式化需 K/M 與 w（萬）並存於不同語境。
- 無使用者帳號、無多人協作、無權限模型。

## Brand Commitments

- 產品名 `BiliAnalyzer` 保留。
- 現有 i18n 文案為既有內容，重設計不得竄改事實性文字（可補新 key）。
- **無**既有品牌資產（無 logo、無指定字體、無指定色）。現行外觀是 shadcn 腳手架預設值，不構成視覺權威 —— 依使用者指示，本次為**替換式重設計**。

## Evidence on Hand

- 真實後端 API 與真實資料模型（`frontend/src/types/index.ts`、`backend/app/api/*`）—— 所有畫面都有真資料可接，不需編造。
- `frontend/src/assets/hero.png`、`react.svg`、`vite.svg` 為 Vite 樣板殘留，非產品資產。
- `frontend/src/App.css` 為 Vite 樣板殘骸，未被任何元件引用。
- **不存在**：logo、品牌字體、行銷素材、使用者見證、實際使用數據截圖。不得虛構。

## Product Principles

1. **結論先於數字。** 好奇的觀眾要的是一句話，不是八張計數卡。數字是證據，放在結論之後。
2. **一切可下鑽。** 每個聚合值都應能走到產生它的原始素材（詞 → 彈幕原文；情感分數 → 該則評論；平均值 → 那支影片）。這是產品相對於一般看板的真正機制。
3. **等待與空缺是設計對象。** 抓取中、SESSDATA 未設、AI 未設、情感分析跑中、無查詢 —— 這五個狀態出現的頻率高於完整儀表板，必須被設計而非被 `<p>loading</p>` 打發。
4. **顏色帶語義，不做裝飾。** 播放／點讚／投幣沒有天生的顏色；情感的正負、狀態的成敗才有。彩虹化的統計卡是雜訊。
5. **雙語與雙主題是約束，不是選項。** 任何硬寫的顏色、字級、文案都是債。

## Accessibility & Inclusion

- 明暗兩主題皆須達 WCAG AA 對比（現行 `text-muted-foreground` 在深色下多處僅約 4.0:1，未達標）。
- 圖表資訊不得僅靠顏色傳達（情感正負、性別分佈需有形狀／標籤／次序輔助）。
- 鍵盤可完整操作：側欄查詢清單、詞雲下鑽面板、AI 面板、對話框皆需可聚焦與 Esc 關閉。
- 中英文混排需正確的行高與字體 fallback（中文不可落到西文字體的替代字形）。
