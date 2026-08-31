import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatExact } from "@/lib/format";
import { NoInk } from "@/components/proof/States";
import type { SentimentDistribution } from "@/types";

/**
 * 情感比例 —— the same ruled proportion the sheet sets everywhere else: a row
 * per pole, a rule per row, the figure beside it. Warm ink reads positive and
 * cool ink negative; the average score is a printed note, not a hero number.
 */

const POLES = [
  { key: "positive", fill: "bg-pos", text: "text-pos" },
  { key: "neutral", fill: "bg-neu", text: "text-ink-3" },
  { key: "negative", fill: "bg-neg", text: "text-neg" },
] as const;

export default function SentimentRule({
  dist,
  source,
  onSegmentClick,
}: {
  dist: SentimentDistribution | null;
  source: string;
  onSegmentClick?: (label: string, source: string) => void;
}) {
  const { t, i18n } = useTranslation();

  if (!dist || dist.count === 0) return <NoInk className="py-6" />;

  const shares: Record<string, number> = {
    positive: dist.positive_pct,
    neutral: dist.neutral_pct,
    negative: dist.negative_pct,
  };
  const max = Math.max(...Object.values(shares), 1);

  return (
    <div className="flex flex-col">
      <ul className="border-t border-rule">
        {POLES.map((p) => (
          <li key={p.key} className="border-b border-rule">
            <button
              type="button"
              onClick={() => onSegmentClick?.(p.key, source)}
              className="group grid w-full grid-cols-[minmax(2.5rem,auto)_1fr_auto] items-center gap-x-2.5 py-1.5 pr-1 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
              title={`${t(`sentiment.${p.key}`)} ${shares[p.key].toFixed(1)}%`}
            >
              <span className="truncate text-note text-ink-2 group-hover:text-ink">
                {t(`sentiment.${p.key}`)}
              </span>
              <span className="h-2.5 min-w-0 bg-paper-3" aria-hidden>
                <span
                  className={cn("block h-full", p.fill)}
                  style={{ width: `${Math.max((shares[p.key] / max) * 100, 1.5)}%` }}
                />
              </span>
              <span className={cn("shrink-0 text-note tabular-nums", p.text)}>
                {shares[p.key].toFixed(1)}%
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="colophon pt-1.5">
        {t("sentiment.avgScore")} {(dist.avg_score * 100).toFixed(0)}
        {" · "}
        {formatExact(dist.count, i18n.language)}
      </p>
    </div>
  );
}
