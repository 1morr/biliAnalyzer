import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatExact } from "@/lib/format";
import { Inking, NoInk } from "@/components/proof/States";
import type { WordFrequencyItem } from "@/types";

/**
 * 鉛字級數詞表 —— frequency IS type size, the way a newspaper ranks its stories.
 * Set as a ruled listing rather than a ragged block: every word keeps its own
 * 號數, but the rows line up and every count prints in its own column, so the
 * table can be read down as well as looked at.
 */

/** 小五 → 三號，七階。上限收在手機兩欄也排得下的級數。 */
const STEPS = [12, 13, 15, 17, 19, 21, 24];

export type WordTableItem = WordFrequencyItem;

export default function WordTable({
  words,
  loading,
  onWordClick,
  limit = 32,
  className,
}: {
  words: WordTableItem[];
  loading: boolean;
  onWordClick: (word: string) => void;
  limit?: number;
  className?: string;
}) {
  const { i18n } = useTranslation();

  const ranked = useMemo(() => {
    const top = [...words].sort((a, b) => b.value - a.value).slice(0, limit);
    const n = Math.max(1, top.length);
    return top.map((w, i) => {
      const step = Math.max(0, STEPS.length - 1 - Math.floor((i / n) * STEPS.length));
      return { ...w, size: STEPS[step] };
    });
  }, [words, limit]);

  if (loading) return <Inking className="py-10" />;
  if (!ranked.length) return <NoInk className="py-10" />;

  return (
    // 開在版邊的批註會把這一欄縮窄，所以看容器不看視窗。
    <div className={cn("@container", className)}>
      <ol className="grid border-t border-rule @xs:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4">
        {ranked.map((w, i) => (
          <li key={w.name} className="min-w-0 border-b border-rule">
            <button
              type="button"
              onClick={() => onWordClick(w.name)}
              title={`${w.name} · ${formatExact(w.value, i18n.language)}`}
              className="group flex min-h-8 w-full items-baseline gap-2.5 py-1 pr-2 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
            >
              <span className="w-5 shrink-0 text-right text-colophon tabular-nums text-ink-3">
                {i + 1}
              </span>
              <span
                className="min-w-0 flex-1 truncate font-song leading-none font-semibold text-ink transition-colors group-hover:text-mark"
                style={{ fontSize: w.size }}
              >
                {w.name}
              </span>
              <span className="shrink-0 text-note tabular-nums text-ink-3">
                {formatExact(w.value, i18n.language)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
