import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import type { VideoComparison } from "@/types";

interface RadarChartProps {
  data: VideoComparison | null;
}

export default function RadarChart({ data }: RadarChartProps) {
  const { t } = useTranslation();

  const METRIC_LABELS = [
    t("stats.totalViews"),
    t("stats.likes"),
    t("stats.coins"),
    t("stats.favorites"),
    t("stats.shares"),
    t("stats.danmaku"),
    t("stats.comments"),
  ];

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  const isDark = document.documentElement.classList.contains("dark");

  // Normalize each metric using global max values from the query
  const videoNorm = data.video_values.map((v, i) => {
    const maxVal = Math.max(data.max_values[i], 1);
    return (v / maxVal) * 100;
  });

  const avgNorm = data.average_values.map((v, i) => {
    const maxVal = Math.max(data.max_values[i], 1);
    return (v / maxVal) * 100;
  });

  const indicators = METRIC_LABELS.map((name) => ({ name, max: 100 }));

  const axisLabelColor = isDark ? "#9ca3af" : "#6b7280";
  const splitLineColor = isDark ? "#1f2937" : "#e5e7eb";

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
    },
    legend: {
      data: [t("video.thisVideo"), t("video.average")],
      bottom: 0,
      textStyle: { color: axisLabelColor, fontSize: 12 },
    },
    radar: {
      indicator: indicators,
      radius: "60%",
      center: ["50%", "48%"],
      splitNumber: 4,
      axisName: { color: axisLabelColor, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLineColor } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: splitLineColor } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: videoNorm,
            name: t("video.thisVideo"),
            areaStyle: { color: "rgba(99,102,241,0.3)" },
            lineStyle: { color: "#6366f1", width: 2 },
            itemStyle: { color: "#6366f1" },
          },
          {
            value: avgNorm,
            name: t("video.average"),
            areaStyle: { color: "rgba(239,68,68,0.05)" },
            lineStyle: { color: "#ef4444", width: 2, type: "dashed" },
            itemStyle: { color: "#ef4444" },
          },
        ],
      },
    ],
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("video.comparison")}</p>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}
