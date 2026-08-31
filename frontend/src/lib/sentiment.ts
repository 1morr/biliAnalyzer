import type { SentimentDistribution } from "@/types";

/** Weighted merge of the danmaku and comment distributions into one reading. */
export function combineDistributions(
  danmaku: SentimentDistribution | null,
  comment: SentimentDistribution | null,
): SentimentDistribution | null {
  const d = danmaku && danmaku.count > 0 ? danmaku : null;
  const c = comment && comment.count > 0 ? comment : null;
  if (!d && !c) return null;
  if (!d) return c;
  if (!c) return d;

  const total = d.count + c.count;
  const mix = (a: number, b: number) =>
    Math.round(((a * d.count + b * c.count) / total) * 10) / 10;

  return {
    avg_score: (d.avg_score * d.count + c.avg_score * c.count) / total,
    positive_pct: mix(d.positive_pct, c.positive_pct),
    neutral_pct: mix(d.neutral_pct, c.neutral_pct),
    negative_pct: mix(d.negative_pct, c.negative_pct),
    count: total,
  };
}

/** Backend scores run 0…1; the word table reads −1…1. */
export function toTone(score: number): number {
  return (score - 0.5) * 2;
}
