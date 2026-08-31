import { useMemo } from "react";
import { useResolvedTheme } from "@/hooks/useTheme";

/**
 * ECharts draws on canvas and cannot interpolate `oklch()`, so every token is
 * resolved to sRGB once per theme change. The browser's own parser does the
 * conversion — no colour maths here, and no second copy of the palette.
 */
function toSrgb(value: string): string {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return value;
  ctx.fillStyle = "#000000";
  ctx.fillStyle = value.trim();
  return ctx.fillStyle as string;
}

function token(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  return toSrgb(raw || "#000000");
}

export interface ChartTokens {
  paper: string;
  paper2: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  rule2: string;
  ruleStrong: string;
  mark: string;
  pencil: string;
  pos: string;
  neu: string;
  neg: string;
  /** One ink ramp, dark to light. Categorical series borrow from it in order. */
  seq: [string, string, string, string, string];
  font: string;
  fontSong: string;
}

function readTokens(): ChartTokens {
  const font = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-hei")
    .trim();
  const fontSong = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-song")
    .trim();
  return {
    paper: token("--paper"),
    paper2: token("--paper-2"),
    ink: token("--ink"),
    ink2: token("--ink-2"),
    ink3: token("--ink-3"),
    rule: token("--rule"),
    rule2: token("--rule-2"),
    ruleStrong: token("--rule-strong"),
    mark: token("--mark"),
    pencil: token("--pencil"),
    pos: token("--pos"),
    neu: token("--neu"),
    neg: token("--neg"),
    seq: [
      token("--seq-1"),
      token("--seq-2"),
      token("--seq-3"),
      token("--seq-4"),
      token("--seq-5"),
    ],
    font,
    fontSong,
  };
}

/** Chart tokens for the current theme; recomputes when the theme flips. */
export function useChartTokens(): ChartTokens {
  const resolved = useResolvedTheme();
  // readTokens() reads live CSS custom properties, so the resolved theme IS the
  // dependency — there is nothing else for the linter to see.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readTokens(), [resolved]);
}

/** 六號 —— axis ticks sit at the bottom of the type scale. */
export const AXIS_SIZE = 10;
/** 小五 —— axis names and legends. */
export const NAME_SIZE = 12;

export function compactNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

/**
 * The shared chart chrome: rules instead of frames, no rounded corners, no
 * drop shadows. Spread it into every option and override only the series.
 */
export function chartBase(k: ChartTokens) {
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: k.font, color: k.ink2 },
    animationDuration: 420,
    animationEasing: "cubicOut" as const,
    tooltip: {
      backgroundColor: k.paper,
      borderColor: k.ruleStrong,
      borderWidth: 1,
      borderRadius: 0,
      padding: [7, 10],
      textStyle: { color: k.ink, fontSize: NAME_SIZE, fontFamily: k.font },
      extraCssText: "box-shadow: none; letter-spacing: 0.01em;",
    },
  };
}

/** A category axis drawn as a column rule. */
export function categoryAxis(k: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    type: "category" as const,
    axisLabel: { color: k.ink3, fontSize: AXIS_SIZE, fontFamily: k.font },
    axisLine: { lineStyle: { color: k.rule2 } },
    axisTick: { lineStyle: { color: k.rule2 }, alignWithLabel: true },
    ...extra,
  };
}

/** A value axis: no axis line, hairline grid only — the page carries the frame. */
export function valueAxis(k: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    type: "value" as const,
    axisLabel: {
      color: k.ink3,
      fontSize: AXIS_SIZE,
      fontFamily: k.font,
      formatter: (v: number) => compactNumber(v),
    },
    nameTextStyle: { color: k.ink3, fontSize: NAME_SIZE, fontFamily: k.font },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: k.rule, width: 1, type: "solid" as const } },
    ...extra,
  };
}
