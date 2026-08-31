---
name: BiliAnalyzer
description: 一張還在編輯手上的校樣 —— 資料被排版，不被裝進卡片。
colors:
  paper: "oklch(0.955 0.008 85)"
  paper-2: "oklch(0.928 0.009 85)"
  paper-3: "oklch(0.898 0.010 85)"
  ink: "oklch(0.205 0.012 60)"
  ink-2: "oklch(0.435 0.012 60)"
  ink-3: "oklch(0.485 0.010 60)"
  rule: "oklch(0.815 0.010 80)"
  rule-2: "oklch(0.700 0.010 80)"
  rule-strong: "oklch(0.300 0.012 60)"
  mark: "oklch(0.530 0.190 33)"
  mark-ink: "oklch(0.985 0.004 85)"
  mark-wash: "oklch(0.530 0.190 33 / 0.10)"
  pencil: "oklch(0.470 0.110 250)"
  pencil-wash: "oklch(0.470 0.110 250 / 0.10)"
  pos: "oklch(0.430 0.055 45)"
  neu: "oklch(0.760 0.005 80)"
  neg: "oklch(0.500 0.045 250)"
  seq-1: "oklch(0.255 0.014 60)"
  seq-2: "oklch(0.400 0.014 65)"
  seq-3: "oklch(0.545 0.012 70)"
  seq-4: "oklch(0.690 0.011 75)"
  seq-5: "oklch(0.815 0.010 80)"
typography:
  masthead:
    fontFamily: "Noto Serif SC Variable, Songti SC, SimSun, Source Han Serif SC, serif"
    fontSize: "2.1875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Noto Serif SC Variable, Songti SC, SimSun, Source Han Serif SC, serif"
    fontSize: "1.8125rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.01em"
  subhead:
    fontFamily: "Noto Serif SC Variable, Songti SC, SimSun, Source Han Serif SC, serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.01em"
  lede:
    fontFamily: "Libre Franklin Variable, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: "0.015em"
  body:
    fontFamily: "Libre Franklin Variable, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "0.015em"
  ui:
    fontFamily: "Libre Franklin Variable, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.005em"
    fontFeature: "tabular-nums lining-nums"
  note:
    fontFamily: "Libre Franklin Variable, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Libre Franklin Variable, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.14em"
  colophon:
    fontFamily: "Libre Franklin Variable, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.1em"
rounded:
  none: "0px"
spacing:
  head: "4.25rem"
  gutter: "1.5rem"
  page-x: "1rem"
  page-x-md: "2rem"
  column-gap-x: "1.5rem"
  column-gap-y: "2rem"
  section-gap: "2.5rem"
  note-gutter: "48px"
components:
  button-default:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2rem"
  button-default-hover:
    backgroundColor: "{colors.mark}"
    textColor: "{colors.mark-ink}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2rem"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.mark}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  masthead:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.masthead}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "4.25rem"
  ledger-cell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.lede}"
    rounded: "{rounded.none}"
    padding: "0.75rem"
  ledger-cell-open:
    backgroundColor: "{colors.mark-wash}"
    textColor: "{colors.mark}"
  marginalia:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1rem"
    width: "27rem"
---

# Design System: BiliAnalyzer

## Overview

**Creative North Star: "校樣間 / The Proof Sheet"**

這個介面是一張還在編輯手上的校樣：資料被排版，不被裝進卡片。它拒絕這個品類的固定編排 —— 卡片格、大數字、趨勢徽章、一種品牌強調色 —— 改用中文報刊的鉛字排版與編輯的校對記號來組織資訊。欄線代替卡片邊框，著重號代替螢光底色，字級代替色塊。

材料只有五種：紙（`paper` 三階）、墨（`ink` 三階與一條墨階 `seq-1…5`）、欄線（`rule` / `rule-2` / `rule-strong`）、朱批（`mark`，編輯的手）、藍鉛筆（`pencil`，系統自己的話）。沒有第六種材料。任何想加顏色的衝動，答案都是換一級墨色、換一級欄線寬、或換一級字級。

深色不是把紙調暗，是製版負片：黑底、白字、細亮欄線，整條墨階反轉。兩個主題都是一等公民，值在 `frontend/src/index.css` 的 `:root` 與 `.dark` 各寫一次，不由對方推導。

**Key Characteristics:**
- 五種材料，沒有第六種；`--radius: 0` 全域無圓角。
- 欄線與墨色承擔層級，卡片與陰影不承擔。
- 中文原生的強調（著重號），不是加粗與螢光筆。
- 標題宋體、正文與數字 Franklin（中文落黑體）；全域 `tabular-nums lining-nums`。
- 「圖表形狀」的東西盡量改印成表：詞表、墨階格、排行條表、增減欄。
- 深色 = 負片；淺色 = 新聞紙。

## Colors

一條暖白到鉛黑的紙墨軸，加上兩支只屬於「手」的筆：朱批紅與藍鉛筆。

### Primary
- **朱批紅 Vermilion**（`mark`）：編輯的手。選中的查詢、下鑽開啟的欄格（以 `mark-wash` 淡痕）、旁批標題、焦點外框（`:focus-visible` 2px）、連結 hover、輸入游標、`::selection` 底。凡是「人動了一下」才出現。
- **朱批上的字**（`mark-ink`）：只在朱批被反白填滿的瞬間（按鈕 hover）當作字色。
- **朱批淡痕**（`mark-wash`）：被點開的那一格統計欄留下的痕跡 —— 旁批在說的是這一格，靠這道痕跡指認來源。

### Secondary
- **藍鉛筆 Blue Pencil**（`pencil` / `pencil-wash`）：系統自己的話。抓取進度、工序進行中的鉛條、缺欄提示的虛線框與底、儲存成功的回話。它從不表示「好／壞」，只表示「這是機器寫上去的」。

### Tertiary
- **暖墨 / 中性 / 冷墨**（`pos` / `neu` / `neg`）：情感兩極。刻意做成一暖一冷的低彩度墨，不是紅綠；朱批與藍鉛筆是編輯的手，不下放做資料色。
- **墨階 Ink Ramp**（`seq-1…seq-5`）：所有圖表的序列色，一條由深到淺的墨，不是彩虹。分類系列按順序借用它。

### Neutral
- **新聞紙**（`paper`）：版面底色；`paper-2` 是欄內底與表頭（檢字架整條側欄）；`paper-3` 壓深一階，是 hover 與選中底。
- **鉛字黑**（`ink`）：正文與數字；`ink-2` 次要文字；`ink-3` 最弱文字（欄標題、版權標記行、軸標籤），在紙與欄底上皆過 4.5:1。
- **欄線**（`rule` 細線、`rule-2` 中線／表格橫線與輸入框邊、`rule-strong` 報頭粗線與版面主分界）。

### Named Rules
**五種材料 The Five Materials Rule.** 紙、墨、欄線、朱批、藍鉛筆。要表達新的差別時，先用墨色階、欄線粗細、字級與位置；沒有第六種顏色可以發明。

**朱批之手 The Editor's Hand Rule.** 朱批紅只標記人的動作，藍鉛筆只標記系統的話，資料一律是墨。播放、按讚、投幣沒有天然顏色，給它們一人一色就是把裝飾當語意。

**朱批不當底色 The Vermilion Is A Mark Rule.** 朱批不做控制項的靜止底色：`destructive` 按鈕是紅字紅框透明底，只有 hover 的瞬間反白；被下鑽的欄格只上 10% 淡痕 `mark-wash`。可以整塊上朱批的，只有本身就是「一筆」的元素 —— 校對記號的筆畫、排行條表被選中的比例條、工序出錯的鉛條。

**負片 The Negative Plate Rule.** 深色不是把紙調暗，是重新製版：紙翻黑、墨翻白、墨階整條反轉。不得以降低亮度的方式從淺色值推導深色值。

## Typography

**Display / 標題字：** Noto Serif SC Variable（宋體；fallback Songti SC、SimSun、Source Han Serif SC）
**Body / 正文與數字：** Libre Franklin Variable（新聞體）＋ Noto Sans SC Variable（中文黑體）
**Label：** 同正文字族，靠字級（小五／六號）與 0.1–0.14em 字距分辨，不另立字體。

**Character:** 宋體只給標題與節名，黑體＋Franklin 給所有正文、介面與數字。這是報紙的分工：標題是刻出來的，內文是排出來的。

### Hierarchy
鉛字傳統號數，一號封頂：
- **一號 `--t-1` / `text-h1`**（宋體 600，2.1875rem，行距 1.15）：報頭標題。這是整個產品最大的字，沒有更大的一級。
- **二號 `--t-2` / `text-h2`**（1.8125rem）：小螢幕上報頭標題降到這一級並夾成兩行；統計欄的 `lead` 數字也用這一級。
- **三號 `--t-3` / `text-h3`**（1.3125rem）：旁批標題、檢字架刊頭（刊名）、空白樣張的次標。
- **四號 `--t-4` / `text-h4`**（1.1875rem）：節名（宋體 600）、統計欄一般數字（Franklin 500）、導言整段。
- **小四 `--t-x4` / `text-body`**（1rem，行距 1.8，字距 0.015em，`max-width: 68ch`）：中文正文行氣（`.prose-cn`）。
- **五號 `--t-5` / `text-ui`**（0.875rem）：`<body>` 預設級數，介面文字與按鈕。
- **小五 `--t-x5` / `text-note`**（0.75rem）：版邊註記、日期行、欄標題（`.column-label`，字距 0.14em、`ink-3`、大寫）。
- **六號 `--t-6` / `text-colophon`**（0.625rem，字距 0.1em）：版權標記行與圖表軸刻度。**只給這兩種用途**，永遠不用來排要讀的內容。

### Named Rules
**一號封頂 The Masthead-Is-The-Largest Rule.** 級數表自一號起、至六號止（初號、小初不存在）。任何頁面上最大的字就是報頭標題的一號；版面裡不得出現比報頭更響的字，需要更重時改用宋體、欄線與位置，不是加大。

**導言自足 The Self-Contained Lede Rule.** 導言（`dashboard/Lede.tsx`）是一段可以單獨讀完的散文，四號、`.prose-cn`、行距 1.85 —— **它上面沒有標題**。關鍵數字用著重號標出；說「最高的那一支」就必須當場點名並連到它自己的樣張（`/video/:bvid`），不留讀者自己去找的指涉。

**著重號 The Emphasis Dot Rule.** 中文的強調是著重號（`.zhuozhong`，`text-emphasis: filled dot`，朱批色，置於下方右側），不是加粗、不是螢光底、不是換色。導言句裡的關鍵數字用它，其餘地方不用。

**中文不留空 The No ASCII Space Rule.** 中文句子之間不插半形空格；導言的分段連接子隨語言決定（`zh` 為空字串，`en` 為一個空格）。並列項目一律走 `lib/format.ts` 的 `SEP`（全形空格 · 全形空格），不自己拼標點。

**鉛字級數 The Type-Size-Is-Data Rule.** 詞頻用字級表達（`WordTable` 七階：12 / 14 / 16 / 19 / 21 / 29 / 35px），像報紙用字級排新聞輕重。不做詞雲：這是真文字，可讀、可選取、可鍵盤操作，也不吃 canvas。

**對齊的位數 The Tabular Rule.** `<html>` 全域 `font-variant-numeric: tabular-nums lining-nums`。這是分析儀器，數字對齊不是選項。數字格式化一律走 `lib/format.ts`，同一版面不混用兩套單位。

**號數與墨色同住 The `text-*` Collision Rule.** 級數（`text-h1`…`text-colophon`）與墨色（`text-ink`、`text-mark`…）都住在 `text-*` 底下，tailwind-merge 預設會把兩者併成同一組並靜默丟掉前者 —— 那正是按鈕變成「墨上加墨」的路徑。`lib/utils.ts` 用 `extendTailwindMerge` 把兩份清單分別教給它；**新增任何級數或墨色 token 時必須同步加進這兩份清單**，否則它會在某個 `cn()` 呼叫裡消失。

## Layout

側欄（檢字架）固定 236px，桌機常駐、`sm` 以下收進左側抽屜（264px）；版心 `<main>` 獨立捲動。頁面內距 `px-4`（`md:px-8`），節與節之間 `gap-10`（2.5rem），欄與欄之間 `gap-x-6`（`--gutter` 1.5rem）／`gap-y-8`。內容寬度不置中：規格表這類窄版面用 `max-w-3xl` 靠左壓在報頭下方，不用 `mx-auto` 浮在中間。

分欄由 `Columns` 承擔：`sm` 起在相鄰欄之間畫左欄線並補左內距，換行時交給 row-gap 與花邊（`.rule-double`），而不是把每欄裝進盒子。統計欄（`Ledger`）在 `@container` 下自 2 欄 → `@md` 4 欄 → 超過四項時 `@5xl` 8 欄。

### Named Rules
**一條頭線 The One Head Rule.** 檢字架的刊頭與每頁的報頭高度都是 `--head-h`（4.25rem），兩條 2px 粗線接成橫貫整個視窗的一條頭線。報頭是**單列**：手機目錄鈕、可選的 `back` 返回連結、標題、右側動作 —— 不得在標題上方加第二行小字，也不得在報頭之上加全域列。`meta` 印在粗線**下方**，是一條會隨頁面捲走的日期行（細欄線 `rule` 收底），不黏在頂端。`sm` 以下頭部改為可長高，標題降到二號並夾成兩行。

**報頭永在 The Sheet Always Has A Head Rule.** 空白樣張、載入中、錯誤狀態一律保留報頭 —— 手機上那個頭是回到索引的唯一路徑。

**容器在外 The Container-Is-The-Parent Rule.** `@container` 標在被查詢元素的**父層**，永不標在它自己身上；一個元素查不到自己的容器，這個錯不會報錯，只會讓版面永遠停在最窄那一階。凡是會因旁批讓出版邊而變窄（視窗卻沒變）的欄，一律這樣接。

**版邊而非蓋版 The Margin, Not The Overlay Rule.** 旁批打開時版面不變暗、不加遮罩、不失焦（`modal={false}`，無 backdrop）。`≥1024px` 時內容欄讓出右緣：`--note-margin = 註記寬 + 48px 空巷`，由 `<main>` 讀取並以 220ms 過渡讓位。註記寬 27rem（對話長度的素材用 38rem）。低於這個寬度沒有版邊可讓，註記直接覆蓋整張紙 —— 手機上沒有可以寫字的版邊。

**來源自證 The Note Says Its Own Source Rule.** 旁批**不畫引線**。註記在說什麼，由它自己的標題（朱批色、三號宋體）說，再加上被點開的那一格統計欄留下的朱批淡痕與朱批字色。不得為了「連起來」而在版面上補畫任何指向線。

## Elevation & Depth

這個世界是平的。層級由紙色壓深一階（`paper` → `paper-2` → `paper-3`）與欄線粗細（`rule` → `rule-2` → `rule-strong`）表達，不由陰影表達。唯一的陰影 `--shadow-sheet` 只證明「這是另外一張紙」：旁批、下拉選單、對話框這類浮在版面之上的表面。ECharts 的提示框明確關掉陰影與圓角。

### Shadow Vocabulary
- **另一張紙**（`--shadow-sheet`：淺色 `0 2px 28px oklch(0.2 0.01 60 / 0.16)`／深色 `0 2px 32px oklch(0 0 0 / 0.55)`）：僅用於浮出版面的表面。

### Named Rules
**紙不投影 The Flat Sheet Rule.** 陰影只證明「這是另一張紙」，不表達高低。版心裡的任何欄、格、列、按鈕都不得帶陰影；需要分層時壓紙色一階或換一級欄線。

## Shapes

方角，永遠。`--radius: 0`，`--radius-sm` 到 `--radius-4xl` 全部覆寫為 `0px`。形狀語彙是線與塊：2px 粗線是頭線與主分界，1px 細線是欄線與列線，`.rule-double`（一條中線加 `box-shadow` 偽出的第二條）是節與節之間的花邊。虛線只有一種用途：缺欄（`MissingColumn`）的藍鉛筆虛線框。校對記號自己畫（`proof/marks.tsx`，16 網格、1.5 描邊、圓端），與 lucide 圖示同一套語法並列不露縫。

### Named Rules
**方角 The Square Corner Rule.** 半徑永遠是 0。任何引入的第三方元件都必須先被壓成方角才算落地。

## Components

### Buttons
- **Shape:** 方角，一律帶 1px 邊（`border`），字距 0.02em，120ms 顏色過渡，`active` 時下沉 1px。
- **Primary（`default`）:** 墨底紙字（`bg-ink text-paper`），hover 整塊翻成朱批（`bg-mark text-mark-ink`）。留給推進工作的那一個動作。
- **Outline / Secondary / Ghost:** 透明或 `paper-2` 底，hover 壓到 `paper-3`；`ghost` 靜止時是 `ink-2`，hover 才回到 `ink`。
- **Destructive:** 紅字紅框透明底，hover 才反白成朱批底。
- **Focus:** `outline: 2px solid var(--mark)`，offset 2px（與全域 `:focus-visible` 同一規格）。
- **尺寸:** 桌機 `h-8`（`sm` 7、`lg` 9、`xs` 6），**`max-sm` 一律加高到至少 40px** —— 桌機的密度不該由手指買單。

### Inputs / Fields
- **Style:** 1px `rule-2` 邊、透明底、五號字、`h-8`（`max-sm:h-10`）；placeholder 用 `ink-3`。
- **Focus:** 邊線轉朱批，外加 40% 不透明度的朱批外框（offset 1px）；游標色永遠是朱批。
- **Invalid / Disabled:** `aria-invalid` 轉朱批邊；停用時壓 `paper-2` 底、透明度 55%。

### Navigation（檢字架 Sidebar）
- 整條側欄以 `paper-2` 與版心區隔，右緣 `rule-strong`；頂端刊頭 `--head-h` 高，宋體三號刊名加六號小標。
- 稿件目錄每列以細欄線分隔：宋體五號標題、小五日期與摘要；抓取中的進度走藍鉛筆，非進行中的異常狀態走朱批。
- 選中的那一列翻成 `paper` 底、標題轉朱批，並在左緣壓一枚圈選記號（`CircleMark`）——「這一條被圈起來了」。
- 底部版邊控制列（設定、主題、語言）以 `rule-strong` 收底，全部是 `ghost` 按鈕。

### 報頭 Masthead（signature）
單列、`sticky`、`--head-h` 高、2px `rule-strong` 收底、`paper` 底。組成順序固定：手機目錄鈕 → 可選 `back` 返回連結（右側帶一條 `rule` 分隔，小五 `ink-3`，hover 轉朱批）→ 一號宋體標題 → 右側動作。`meta` 以 `<dl>` 印在粗線下方，欄標題配小五數字，細欄線收底。

### 統計欄 Ledger（signature）
一列被欄線切開的數字，不是卡片，也不是一數字一色：`Figure` 的標籤在上（`.column-label`）、數字在下（Franklin、`tabular-nums`、四號 500 或 `lead` 二號 600），墨色承擔全部。可下鑽時整格是按鈕：hover／focus 壓 `paper-2`，被打開時上朱批淡痕並把數字轉朱批。`title` 屬性帶精確值。

### 旁批 Marginalia（signature）
從右緣滑入的一張紙：`rule-strong` 左邊線、`shadow-sheet`、220ms `cubic-bezier(0.16,1,0.3,1)` 位移＋淡入。頭部是朱批色三號宋體的主題名與小五 meta，右上角 `ghost` 關閉鈕。它讓版面讓出版邊，而不是蓋住版面（見 Layout）。

### 版面元件 Sheet
`Section`（花邊起頭＋四號宋體節名）、`Column`（欄標題＋內容）、`Columns`（欄間畫線取代盒子）、`Figure`、`Emphasis`（著重號）、`Colophon`（六號、細線收底、以 `SEP` 串接）、`InkIn`（380ms 逐欄顯影）。

### 狀態 States
- **付印工序 `PressRun`:** 每道後端階段一列，左側鉛條方塊表示狀態（完成＝實心墨、進行中＝藍鉛筆脈動、等待＝空框、錯誤＝實心朱批、略過＝灰填）。
- **缺欄 `MissingColumn`:** 藍鉛筆虛線框＋`pencil-wash` 底＋補字記號，說明缺什麼、往哪裡補。
- **空版 `EmptyForme` / 空白樣張 `BlankSheet`:** 排好的欄線還沒上墨；空白樣張保留報頭。
- **上墨 `InkPulse` / `Inking`:** 一格墨在呼吸取代 spinner —— 動作語彙是墨的出現，不是東西在轉；`ink-in` 顯影取代骨架屏閃爍，並整體服從 `prefers-reduced-motion`。

### 印出來的圖（signature）
凡是能印成表的就不畫成圖：詞雲 → **鉛字級數詞表**（`WordTable`，字級即詞頻）；熱力圖 → **HTML 墨階格**（`PublishTimeGrid`，一種色相、可選取的真文字）；圓餅／甜甜圈 → **排行條表**（`RankedBars`，比例條＋精確百分比，可鍵盤操作）；單邊長條 → **增減欄**（`ComparisonBars`，以中線為軸，上方靠右走朱批、下方靠左走藍鉛筆，方向先由位置說、再由顏色說）。

### 圖表 Charts（ECharts）
顏色一律在執行時從 CSS 自訂屬性讀出（`lib/chart-theme.ts`），並借瀏覽器自己的 canvas 解析器把 `oklch()` 轉成 sRGB —— canvas 不會插值 oklch，且系統不留第二份調色盤。主題翻轉由 `hooks/useTheme.ts` 的 `useSyncExternalStore` 推播，圖表才會在 `.dark` class 換掉之後重讀 token（每個元件各自的 `useState` 做不到）。共用底盤：透明背景、無框、無圓角、提示框無陰影；數值軸不畫軸線只留髮絲格線；軸刻度六號（10px）、軸名與圖例小五（12px）。

## Do's and Don'ts

### Do:
- **Do** 讓每一頁以一個報頭起頭，並讓它與檢字架刊頭共用 `--head-h`（4.25rem），使兩條 2px 頭線接成一條。
- **Do** 把 `meta` 當成報頭粗線下方的日期行處理：細欄線、小五、隨頁捲走。
- **Do** 用著重號標導言裡的關鍵數字，並在句中直接點名那支影片、連到它自己的樣張。
- **Do** 用欄線與紙色階分層；需要更重時換字級或改宋體，不加陰影、不加圓角、不加第六種顏色。
- **Do** 新增級數或墨色 token 時同步更新 `lib/utils.ts` 的 `extendTailwindMerge` 兩份清單。
- **Do** 把 `@container` 標在被查詢元素的父層。
- **Do** 讓圖表顏色從 CSS 自訂屬性讀，並讓主題切換觸發重讀。
- **Do** 在 `max-sm` 把每個可點控制項加高到至少 40px。
- **Do** 先問「這能不能印成表」再決定畫圖。

### Don't:
- **Don't** 在報頭標題上方加眉題／小字（kicker、eyebrow）；報頭唯一允許的前置元素是 `back` 返回連結。
- **Don't** 在版面上出現比一號更大的字，也不要復活初號／小初。
- **Don't** 為導言加標題 —— 它是一段自足的散文。
- **Don't** 為旁批補畫引線或任何指向線；來源由註記標題與被點格上的朱批淡痕交代。
- **Don't** 用朱批當控制項的靜止底色，也不要把朱批或藍鉛筆下放去當資料色。
- **Don't** 在版心裡給任何欄、格、列、按鈕加陰影；`--shadow-sheet` 只給浮出的整張紙。
- **Don't** 讓任何圓角落地（半徑一律 0），也不要引入第二套字體或第二條調色盤。
- **Don't** 用六號（0.625rem）排要閱讀的內容 —— 它只給版權標記行與軸刻度。
- **Don't** 在窄版面上用 `mx-auto` 把內容置中；規格表這類版面靠左壓在報頭下方（`max-w-3xl`），並以細欄線起頭，不再來第二條粗線。
- **Don't** 在版權標記行裡重印 "BiliAnalyzer" 字樣 —— 刊名已經在檢字架刊頭上了。
- **Don't** 在中文句子之間插半形空格；並列項目走 `SEP`。
- **Don't** 用 spinner 或骨架屏；等待用鉛條工序、上墨脈動與逐欄顯影。
