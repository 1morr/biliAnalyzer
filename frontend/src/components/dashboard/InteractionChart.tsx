import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { InteractionData } from "@/types";

interface InteractionChartProps {
  queryId: number;
  totalViews?: number;
}

export default function InteractionChart({ queryId, totalViews }: InteractionChartProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<InteractionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getInteraction(queryId)
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryId]);

  const isDark = document.documentElement.classList.contains("dark");

  const categories = [
    t("stats.likes"),
    t("stats.coins"),
    t("stats.favorites"),
    t("stats.shares"),
  ];
  const colors = ["#ef4444", "#f59e0b", "#a855f7", "#06b6d4"];
  const values = data ? [data.likes, data.coins, data.favorites, data.shares] : [];

  const avgInteractionRate =
    data && totalViews && totalViews > 0
      ? ((data.likes + data.coins + data.favorites + data.shares) / totalViews * 100).toFixed(2)
      : null;

  const option = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#374151" : "#e5e7eb" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 11,
        formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v),
      },
      splitLine: { lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" } },
    },
    series: [
      {
        name: t("chart.interaction"),
        type: "bar",
        data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
        barMaxWidth: 60,
      },
    ],
    grid: { left: 50, right: 16, top: 16, bottom: 40 },
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t("chart.interaction")}</p>
        {avgInteractionRate && (
          <span className="text-xs text-muted-foreground">
            {t("stats.interactionRate")}: <span className="font-semibold text-foreground">{avgInteractionRate}%</span>
          </span>
        )}
      </div>
      <ReactECharts option={option} style={{ height: 220 }} />
    </div>
  );
}
