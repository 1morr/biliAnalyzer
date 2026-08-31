import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatExact } from "@/lib/format";
import { Column, Columns } from "@/components/proof/Sheet";
import ToneKey from "./ToneKey";
import type { DemographicSentimentCell } from "@/types";

const DIMENSION_ORDER = ["gender", "vip", "level", "location"] as const;

const SEGMENTS = [
  { key: "positive_pct", fill: "bg-pos" },
  { key: "neutral_pct", fill: "bg-neu" },
  { key: "negative_pct", fill: "bg-neg" },
] as const;

/**
 * 受眾 × 情感 —— the crossing an ordinary dashboard cannot make. One printed
 * row per category, its rule split by sentiment, its score set in figures.
 */
export default function SentimentMatrix({
  data,
  onCellClick,
}: {
  data: DemographicSentimentCell[];
  onCellClick?: (dimension: string, category: string) => void;
}) {
  const { t, i18n } = useTranslation();

  const grouped = useMemo(() => {
    return DIMENSION_ORDER.map((dim) => {
      const rows = data
        .filter((d) => d.dimension === dim)
        .sort((a, b) => b.count - a.count)
        .slice(0, dim === "location" ? 10 : undefined);
      return { dim, rows };
    }).filter((g) => g.rows.length > 0);
  }, [data]);

  if (!grouped.length) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* 同樣四個維度在「受眾維度」已經排過一次；這裡量的是別的東西，
          刻度與單位就得當場交代。 */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 border-b border-rule pb-2">
        <p className="max-w-[52ch] text-note leading-relaxed text-ink-3">
          {t("sentiment.matrixNote")}
        </p>
        <ToneKey />
      </div>

      <Columns className="sm:grid-cols-2 xl:grid-cols-4">
      {grouped.map(({ dim, rows }) => (
        <Column key={dim} label={t(`sentiment.dim.${dim}`)}>
          <ul className="border-t border-rule">
            {rows.map((cell) => (
              <li key={cell.category} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => onCellClick?.(dim, cell.category)}
                  className="group grid w-full grid-cols-[minmax(3.5rem,auto)_1fr_auto] items-center gap-x-2.5 py-1.5 pr-1 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
                  title={`${cell.category} · ${formatExact(cell.count, i18n.language)}`}
                >
                  <span className="truncate text-note text-ink-2 group-hover:text-ink">
                    {cell.category}
                  </span>
                  <span className="flex h-2.5 min-w-0 border border-rule" aria-hidden>
                    {SEGMENTS.map((s) => (
                      <span
                        key={s.key}
                        className={cn("h-full", s.fill)}
                        style={{ width: `${cell[s.key]}%` }}
                      />
                    ))}
                  </span>
                  <span className="shrink-0 text-note tabular-nums text-ink-3">
                    {(cell.avg_score * 100).toFixed(0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Column>
      ))}
      </Columns>
    </div>
  );
}
