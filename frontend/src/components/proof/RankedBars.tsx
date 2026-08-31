import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatExact } from "@/lib/format";

export interface RankedItem {
  /** Display name, already translated. */
  name: string;
  value: number;
  /** The raw backend value the filter speaks in. */
  raw: string;
}

/**
 * 排行條表 —— a ruled frequency table with a proportional rule per row.
 * It replaces the donut: it reads in greyscale, it is keyboard-operable, and
 * the exact count sits next to the bar instead of inside a tooltip.
 */
export default function RankedBars({
  items,
  selected,
  onToggle,
  collapseAfter = 8,
  className,
}: {
  items: RankedItem[];
  selected: string[];
  onToggle: (raw: string) => void;
  collapseAfter?: number;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { rows, total, hidden } = useMemo(() => {
    const sum = items.reduce((s, i) => s + i.value, 0) || 1;
    const max = Math.max(...items.map((i) => i.value), 1);
    const visible = expanded ? items : items.slice(0, collapseAfter);
    return {
      total: sum,
      hidden: items.length - visible.length,
      rows: visible.map((i) => ({
        ...i,
        share: (i.value / sum) * 100,
        width: (i.value / max) * 100,
      })),
    };
  }, [items, expanded, collapseAfter]);

  if (!items.length) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      <ul className="border-t border-rule">
        {rows.map((r) => {
          const on = selected.includes(r.raw);
          return (
            <li key={r.raw} className="border-b border-rule">
              <button
                type="button"
                onClick={() => onToggle(r.raw)}
                aria-pressed={on}
                className="group grid w-full grid-cols-[minmax(4.5rem,auto)_1fr_auto] items-center gap-x-2.5 py-1.5 pr-1 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
                title={`${r.name} · ${formatExact(r.value, i18n.language)} (${r.share.toFixed(1)}%)`}
              >
                <span
                  className={cn(
                    "truncate text-note transition-colors",
                    on ? "font-medium text-mark" : "text-ink-2 group-hover:text-ink",
                  )}
                >
                  {r.name}
                </span>

                <span className="h-2.5 min-w-0 bg-paper-3" aria-hidden>
                  <span
                    className={cn(
                      "block h-full transition-[background-color,width] duration-200",
                      on ? "bg-mark" : "bg-rule-2 group-hover:bg-ink-3",
                    )}
                    style={{ width: `${Math.max(r.width, 1.5)}%` }}
                  />
                </span>

                <span className="shrink-0 text-note tabular-nums text-ink-3">
                  {r.share.toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between gap-3 pt-1.5">
        <span className="colophon">
          {t("demographics.total", { n: formatExact(total, i18n.language) })}
        </span>
        {(hidden > 0 || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-colophon tracking-[0.1em] text-ink-3 uppercase hover:text-mark"
          >
            {expanded ? t("common.collapse") : t("common.showAll", { n: items.length })}
          </button>
        )}
      </div>
    </div>
  );
}
