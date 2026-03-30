import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import type { VideoSummary } from "@/types";

interface ScatterChartProps {
  videos: VideoSummary[];
}

export default function ScatterChart({ videos }: ScatterChartProps) {
  const { t } = useTranslation();

  const isDark = document.documentElement.classList.contains("dark");

  const scatterData = videos.map((v) => ({
    value: [v.stats.views, v.stats.interaction_rate],
    name: v.title,
  }));

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: { data: { name: string; value: number[] } }) => {
        const d = params.data;
        return `${d.name}<br/>Views: ${d.value[0].toLocaleString()}<br/>IR: ${(d.value[1] * 100).toFixed(2)}%`;
      },
    },
    xAxis: {
      type: "value",
      name: t("stats.totalViews"),
      nameLocation: "middle",
      nameGap: 28,
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 11,
        formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v),
      },
      splitLine: { lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" } },
    },
    yAxis: {
      type: "value",
      name: t("stats.interactionRate"),
      nameLocation: "middle",
      nameGap: 40,
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 11,
        formatter: (v: number) => `${(v * 100).toFixed(1)}%`,
      },
      splitLine: { lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" } },
    },
    series: [
      {
        type: "scatter",
        data: scatterData,
        symbolSize: 8,
        itemStyle: { color: "#6366f1", opacity: 0.7 },
      },
    ],
    grid: { left: 60, right: 20, top: 20, bottom: 50 },
  };

  if (videos.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("chart.scatter")}</p>
      <ReactECharts option={option} style={{ height: 220 }} />
    </div>
  );
}
