/**
 * 數字的兩種語言：中文讀万／亿，英文讀 K/M/B。
 * 同一張版面上不該混用兩套單位，所以格式化一律走這裡。
 */

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$/, "");
}

export function formatCount(n: number, lang: string): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (lang.startsWith("zh")) {
    if (abs >= 1e8) return `${trim(n / 1e8, 2)}亿`;
    if (abs >= 1e4) return `${trim(n / 1e4, 1)}万`;
    return n.toLocaleString("zh-CN");
  }
  if (abs >= 1e9) return `${trim(n / 1e9, 2)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6, 1)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3, 1)}K`;
  return n.toLocaleString("en-US");
}

/** Exact, grouped — for tooltips and marginalia where the real figure matters. */
export function formatExact(n: number, lang: string): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(lang.startsWith("zh") ? "zh-CN" : "en-US");
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatPercent(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${trim(n, digits)}%`;
}

/** Whole days between two ISO dates, inclusive of both endpoints. */
export function daysBetween(start: string, end: string): number | null {
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/**
 * 全形間隔號與全形空格：中文行內分隔的正確字元。
 * 集中在這裡，原始碼裡就不會散落成不規則空白（no-irregular-whitespace）。
 */
export const GAP = "\u3000";
export const SEP = "\u3000\u00b7\u3000";
