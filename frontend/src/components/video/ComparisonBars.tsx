import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { VideoComparison } from "@/types";

interface ComparisonBarsProps {
  data: VideoComparison | null;
}

export default function ComparisonBars({ data }: ComparisonBarsProps) {
  const { t } = useTranslation();
  const [showTip, setShowTip] = useState(false);

  // Metric name translation map
  const metricTranslations: Record<string, string> = {
    views: t("stats.totalViews"),
    likes: t("stats.likes"),
    coins: t("stats.coins"),
    favorites: t("stats.favorites"),
    shares: t("stats.shares"),
    danmaku: t("stats.danmaku"),
    comments: t("stats.comments"),
  };

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <p className="text-sm font-medium text-foreground">{t("video.engagement")}</p>
        <div className="relative">
          <span
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            ?
          </span>
          {showTip && (
            <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md border">
              {t("video.engagementTip")}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {data.metrics.map((metric, i) => {
          const pct = data.percentage_diff[i];
          const isPositive = pct >= 0;
          const displayPct = Math.abs(pct);
          // Cap fill width at 200% difference → 100% bar width
          const barWidth = Math.min((displayPct / 200) * 100, 100);
          const barColor = isPositive ? "bg-green-500" : "bg-red-500";
          const textColor = isPositive ? "text-green-600" : "text-red-500";

          return (
            <div key={metric} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground">{metricTranslations[metric] || metric}</span>
                <span className={`font-medium ${textColor}`}>
                  {isPositive ? "+" : "-"}{displayPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all duration-300`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
