import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { SentimentTrendPoint } from "@/types";

interface Props {
  data: SentimentTrendPoint[];
}

export default function SentimentTrendChart({ data }: Props) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      formatter: (params: Array<{ seriesName: string; value: number; marker: string; dataIndex: number }>) => {
        const date = data[params[0]?.dataIndex]?.date ?? "";
        let html = `<b>${date}</b><br/>`;
        for (const p of params) {
          if (p.value != null) html += `${p.marker} ${p.seriesName}: ${(p.value * 100).toFixed(1)}<br/>`;
        }
        return html;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
    },
    xAxis: {
      type: "category",
      data: data.map((p) => p.date),
      axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? "#374151" : "#e5e7eb" } },
    },
    yAxis: {
      type: "value",
      min: 0, max: 1,
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11,
        formatter: (v: number) => `${(v * 100).toFixed(0)}`,
      },
      splitLine: { lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" } },
    },
    series: [
      {
        name: t("sentiment.danmakuSentiment"),
        type: "line",
        data: data.map((p) => p.danmaku_avg),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#3b82f6", width: 2 },
        itemStyle: { color: "#3b82f6" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.15)" },
              { offset: 1, color: "rgba(59,130,246,0)" },
            ],
          },
        },
      },
      {
        name: t("sentiment.commentSentiment"),
        type: "line",
        data: data.map((p) => p.comment_avg),
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#f59e0b", width: 2 },
        itemStyle: { color: "#f59e0b" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.15)" },
              { offset: 1, color: "rgba(245,158,11,0)" },
            ],
          },
        },
      },
    ],
    grid: { left: 40, right: 12, top: 12, bottom: 36 },
  }), [data, isDark, t]);

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-foreground">{t("sentiment.trend")}</p>
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
  );
}
