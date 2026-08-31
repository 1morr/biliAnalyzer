import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatExact } from "@/lib/format";
import { NoInk } from "@/components/proof/States";
import { cn } from "@/lib/utils";
import type { VideoSummary } from "@/types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * 發布時段 —— a printed density grid: how much ink a cell carries is how well
 * that slot performed. One hue, so it survives greyscale and colour-blind
 * vision, and every cell is real text-addressable markup rather than canvas.
 */
export default function PublishTimeGrid({
  videos,
  onCellClick,
  selectedSlot,
}: {
  videos: VideoSummary[];
  onCellClick?: (slot: { day: number; hour: number; label: string }) => void;
  /** `${day}-${hour}` of the slot whose note is open. */
  selectedSlot?: string | null;
}) {
  const { t, i18n } = useTranslation();

  const { cells, max } = useMemo(() => {
    const bucket = new Map<string, number[]>();
    for (const v of videos) {
      if (!v.published_at) continue;
      const d = new Date(v.published_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getDay()}-${d.getHours()}`;
      const list = bucket.get(key) ?? [];
      list.push(v.stats.views);
      bucket.set(key, list);
    }
    const map = new Map<string, { avg: number; count: number }>();
    let peak = 0;
    for (const [key, views] of bucket) {
      const avg = Math.round(views.reduce((a, b) => a + b, 0) / views.length);
      map.set(key, { avg, count: views.length });
      if (avg > peak) peak = avg;
    }
    return { cells: map, max: Math.max(peak, 1) };
  }, [videos]);

  if (cells.size === 0) return <NoInk className="py-16" />;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}
        >
          <span aria-hidden />
          {HOURS.map((h) => (
            <span
              key={`h-${h}`}
              className="pb-1 text-center text-colophon tabular-nums text-ink-3"
            >
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </span>
          ))}

          {DAY_KEYS.map((day, d) => (
            <div key={day} className="contents">
              <span className="flex items-center pr-2 text-right text-colophon text-ink-3">
                {t(`chart.day.${day}`)}
              </span>
              {HOURS.map((h) => {
                const cell = cells.get(`${d}-${h}`);
                const weight = cell ? 0.1 + (cell.avg / max) * 0.9 : 0;
                const label = `${t(`chart.day.${day}`)} ${String(h).padStart(2, "0")}:00`;
                const title = cell
                  ? `${label} · ${t("stats.avgViews")} ${formatExact(cell.avg, i18n.language)}` +
                    ` · ${t("stats.videoCount")} ${cell.count}`
                  : undefined;
                const style = cell
                  ? {
                      backgroundColor: `color-mix(in oklab, var(--ink) ${Math.round(weight * 100)}%, var(--paper-2))`,
                    }
                  : undefined;

                // Only slots with videos in them have anything to pull out.
                const open = selectedSlot === `${d}-${h}`;
                return cell && onCellClick ? (
                  <button
                    key={`${d}-${h}`}
                    type="button"
                    onClick={() => onCellClick({ day: d, hour: h, label })}
                    className={cn(
                      "aspect-square min-h-3 bg-paper-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mark",
                      // 這一格正被讀在版邊：圈起來。
                      open && "outline-2 outline-offset-1 outline-mark",
                    )}
                    style={open ? { ...style, backgroundColor: "var(--mark)" } : style}
                    title={title}
                    aria-label={title}
                  />
                ) : (
                  <span
                    key={`${d}-${h}`}
                    className="aspect-square min-h-3 bg-paper-2"
                    style={style}
                    title={title}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex items-center justify-end gap-2">
          <span className="colophon">{t("chart.densityLow")}</span>
          <span className="flex gap-px" aria-hidden>
            {[0.1, 0.32, 0.55, 0.78, 1].map((w) => (
              <span
                key={w}
                className="size-2.5"
                style={{ backgroundColor: `color-mix(in oklab, var(--ink) ${Math.round(w * 100)}%, var(--paper-2))` }}
              />
            ))}
          </span>
          <span className="colophon">{t("chart.densityHigh")}</span>
        </div>
      </div>
    </div>
  );
}
