import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { TrendPoint } from "@/types";

interface ViewsTrendChartProps {
  queryId: number;
}

export default function ViewsTrendChart({ queryId }: ViewsTrendChartProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getTrend(queryId)
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryId]);

  const isDark = document.documentElement.classList.contains("dark");

  const option = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: data.map((p) => p.date),
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
        name: t("chart.viewsTrend"),
        type: "line",
        data: data.map((p) => p.views),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#3b82f6", width: 2 },
        itemStyle: { color: "#3b82f6" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.2)" },
              { offset: 1, color: "rgba(59,130,246,0)" },
            ],
          },
        },
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

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("chart.viewsTrend")}</p>
      <ReactECharts option={option} style={{ height: 220 }} />
    </div>
  );
}
