import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import type { VideoSummary } from "@/types";

interface DurationChartProps {
  videos: VideoSummary[];
}

export default function DurationChart({ videos }: DurationChartProps) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const chartData = useMemo(() => {
    // Group videos by duration ranges (in minutes)
    const ranges = [
      { label: "0-1min", min: 0, max: 60 },
      { label: "1-3min", min: 60, max: 180 },
      { label: "3-5min", min: 180, max: 300 },
      { label: "5-10min", min: 300, max: 600 },
      { label: "10-20min", min: 600, max: 1200 },
      { label: "20-30min", min: 1200, max: 1800 },
      { label: "30min+", min: 1800, max: Infinity },
    ];

    const grouped = ranges.map((range) => {
      const filtered = videos.filter(
        (v) => v.duration >= range.min && v.duration < range.max
      );
      const avgViews = filtered.length > 0
        ? filtered.reduce((sum, v) => sum + v.stats.views, 0) / filtered.length
        : 0;
      const avgInteraction = filtered.length > 0
        ? filtered.reduce((sum, v) => sum + v.stats.interaction_rate, 0) / filtered.length
        : 0;

      return {
        label: range.label,
        count: filtered.length,
        avgViews: Math.round(avgViews),
        avgInteraction: Number(avgInteraction.toFixed(2)),
      };
    }).filter((item) => item.count > 0);

    return grouped;
  }, [videos]);

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any[]) => {
        const data = chartData[params[0].dataIndex];
        return `${data.label}<br/>
          ${t("stats.videoCount")}: ${data.count}<br/>
          ${t("stats.avgViews")}: ${data.avgViews.toLocaleString()}<br/>
          ${t("stats.avgInteraction")}: ${data.avgInteraction}%`;
      },
    },
    legend: {
      data: [t("stats.avgViews"), t("stats.avgInteraction")],
      textStyle: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 11,
      },
      top: 0,
    },
    grid: {
      left: 60,
      right: 60,
      top: 40,
      bottom: 50,
    },
    xAxis: {
      type: "category",
      data: chartData.map((d) => d.label),
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 10,
        rotate: 30,
      },
    },
    yAxis: [
      {
        type: "value",
        name: t("stats.avgViews"),
        position: "left",
        axisLabel: {
          color: isDark ? "#9ca3af" : "#6b7280",
          fontSize: 10,
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v),
        },
        splitLine: {
          lineStyle: { color: isDark ? "#1f2937" : "#f3f4f6" },
        },
      },
      {
        type: "value",
        name: t("stats.avgInteraction"),
        position: "right",
        axisLabel: {
          color: isDark ? "#9ca3af" : "#6b7280",
          fontSize: 10,
          formatter: (v: number) => `${v.toFixed(1)}%`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: t("stats.avgViews"),
        type: "bar",
        data: chartData.map((d) => d.avgViews),
        itemStyle: { color: "#6366f1" },
        yAxisIndex: 0,
      },
      {
        name: t("stats.avgInteraction"),
        type: "line",
        data: chartData.map((d) => d.avgInteraction),
        itemStyle: { color: "#f59e0b" },
        yAxisIndex: 1,
        smooth: true,
      },
    ],
  };

  if (videos.length === 0 || chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">
        {t("chart.durationImpact")}
      </p>
      <ReactECharts option={option} style={{ height: 240 }} />
    </div>
  );
}
