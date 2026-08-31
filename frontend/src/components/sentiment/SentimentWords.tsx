import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Column, Columns } from "@/components/proof/Sheet";
import { NoInk } from "@/components/proof/States";
import { formatExact } from "@/lib/format";
import { toTone } from "@/lib/sentiment";
import { cn } from "@/lib/utils";
import type { SentimentWordItem } from "@/types";

/**
 * 兩端詞表 —— the 詞表 section already ranks words by how often they are said.
 * Ranking the same words the same way again, tinted, reads as the same table
 * twice. So this one answers the question only sentiment can: which words do
 * viewers say warmly, and which do they say coldly. Sign and column carry the
 * reading; ink only agrees with them.
 */

/** 後端給的是 0…1，讀成 −1…1 才有「兩端」可言。 */
const CUT = 0.15;

type Ranked = SentimentWordItem & { tone: number };

function Side({
  label,
  rows,
  tone,
  onWordClick,
}: {
  label: string;
  rows: Ranked[];
  tone: "pos" | "neg";
  onWordClick: (word: string) => void;
}) {
  const { i18n } = useTranslation();
  return (
    <Column label={label}>
      {rows.length === 0 ? (
        <NoInk className="py-6" />
      ) : (
        <ol className="border-t border-rule">
          {rows.map((w) => (
            <li key={w.name} className="border-b border-rule">
              <button
                type="button"
                onClick={() => onWordClick(w.name)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto_3.25rem] items-baseline gap-x-3 py-1.5 pr-1 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
                title={`${w.name} · ${formatExact(w.value, i18n.language)} · ${w.tone.toFixed(2)}`}
              >
                <span className="truncate font-song text-body leading-snug font-semibold text-ink transition-colors group-hover:text-mark">
                  {w.name}
                </span>
                <span className="text-note tabular-nums text-ink-3">
                  {formatExact(w.value, i18n.language)}
                </span>
                <span
                  className={cn(
                    "text-right text-note tabular-nums",
                    tone === "pos" ? "text-pos" : "text-neg",
                  )}
                >
                  {w.tone > 0 ? "+" : ""}
                  {w.tone.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Column>
  );
}

export default function SentimentWords({
  words,
  limit = 14,
  onWordClick,
}: {
  words: SentimentWordItem[];
  limit?: number;
  onWordClick: (word: string) => void;
}) {
  const { t } = useTranslation();

  const { warm, cold } = useMemo(() => {
    const byScore: Ranked[] = words
      .map((w) => ({ ...w, tone: toTone(w.avg_score) }))
      .sort((a, b) => b.tone - a.tone);
    return {
      warm: byScore.filter((w) => w.tone >= CUT).slice(0, limit),
      cold: byScore
        .filter((w) => w.tone <= -CUT)
        .reverse()
        .slice(0, limit),
    };
  }, [words, limit]);

  if (!warm.length && !cold.length) return <NoInk className="py-8" />;

  return (
    <Columns className="sm:grid-cols-2">
      <Side
        label={t("sentiment.warmest")}
        rows={warm}
        tone="pos"
        onWordClick={onWordClick}
      />
      <Side
        label={t("sentiment.coldest")}
        rows={cold}
        tone="neg"
        onWordClick={onWordClick}
      />
    </Columns>
  );
}
