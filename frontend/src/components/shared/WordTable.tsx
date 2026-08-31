import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatExact } from "@/lib/format";
import { Inking, NoInk } from "@/components/proof/States";
import type { WordFrequencyItem } from "@/types";

/**
 * 鉛字級數詞表 —— frequency IS type size, the way a newspaper ranks its stories.
 * Replaces the rotating multi-colour word cloud: this is real text, so it is
 * readable, selectable, keyboard-operable, and it costs no canvas.
 */

/** 小五 · 五號 · 小四 · 四號 · 三號 · 二號 · 一號 */
const STEPS = [12, 14, 16, 19, 21, 29, 35];

export interface WordTableItem extends WordFrequencyItem {
  /** -1…1 sentiment, when the table is ranking sentiment-bearing words. */
  tone?: number;
  toneLabel?: string;
}

function toneClass(tone: number | undefined): string {
  if (tone === undefined) return "text-ink";
  if (tone > 0.15) return "text-pos";
  if (tone < -0.15) return "text-neg";
  return "text-ink-3";
}

export default function WordTable({
  words,
  loading,
  onWordClick,
  limit = 60,
  showTone = false,
  minHeight = 200,
  className,
}: {
  words: WordTableItem[];
  loading: boolean;
  onWordClick: (word: string) => void;
  limit?: number;
  showTone?: boolean;
  minHeight?: number;
  className?: string;
}) {
  const { i18n } = useTranslation();

  const ranked = useMemo(() => {
    const top = [...words].sort((a, b) => b.value - a.value).slice(0, limit);
    const n = Math.max(1, top.length);
    return top.map((w, i) => {
      const step = Math.max(0, STEPS.length - 1 - Math.floor((i / n) * STEPS.length));
      return { ...w, size: STEPS[step], step };
    });
  }, [words, limit]);

  if (loading) return <Inking className="py-10" />;
  if (!ranked.length) return <NoInk className="py-10" />;

  return (
    <div
      className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1.5", className)}
      style={{ minHeight }}
    >
      {ranked.map((w) => (
        <button
          key={w.name}
          type="button"
          onClick={() => onWordClick(w.name)}
          title={`${w.name} · ${formatExact(w.value, i18n.language)}${w.toneLabel ? ` · ${w.toneLabel}` : ""}`}
          className={cn(
            "group inline-flex items-baseline gap-1 font-song leading-none font-semibold transition-colors hover:text-mark",
            showTone ? toneClass(w.tone) : "text-ink",
          )}
          style={{ fontSize: w.size }}
        >
          <span className="underline decoration-transparent decoration-1 underline-offset-[0.2em] transition-colors group-hover:decoration-mark">
            {w.name}
          </span>
          {w.step >= 4 && (
            <span className="font-sans text-colophon font-normal tabular-nums text-ink-3">
              {w.value}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
