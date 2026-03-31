import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import type { VideoSummary } from "@/types";

interface PublishTimeHeatmapProps {
  videos: VideoSummary[];
}

export default function PublishTimeHeatmap({ videos }: PublishTimeHeatmapProps) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const heatmapData = useMemo(() => {
    const viewsMap: Record<string, number[]> = {};

    videos.forEach((v) => {
      if (!v.published_at) return;
      const date = new Date(v.published_at);
      const hour = date.getHours();
      const day = date.getDay(); // 0=Sunday, 6=Saturday
      const key = `${day}-${hour}`;

      if (!viewsMap[key]) {
        viewsMap[key] = [];
      }
      viewsMap[key].push(v.stats.views);
    });

    // Calculate average views for each hour-day combination
    const data: [number, number, number][] = [];
    Object.keys(viewsMap).forEach((key) => {
      const [day, hour] = key.split("-").map(Number);
      const avgViews = viewsMap[key].reduce((a, b) => a + b, 0) / viewsMap[key].length;
      data.push([hour, day, Math.round(avgViews)]);
    });

    return data;
  }, [videos]);

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      position: "top",
      formatter: (params: { data: [number, number, number] }) => {
        const [hour, day, views] = params.data;
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return `${days[day]} ${hour}:00<br/>${t("stats.avgViews")}: ${views.toLocaleString()}`;
      },
    },
    grid: {
      left: 50,
      right: 20,
      top: 40,
      bottom: 30,
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      splitArea: { show: true },
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 10,
        interval: 2,
      },
    },
    yAxis: {
      type: "category",
      data: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      splitArea: { show: true },
      axisLabel: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 11,
      },
    },
    visualMap: {
      min: 0,
      max: Math.max(...heatmapData.map((d) => d[2]), 1),
      calculable: true,
      orient: "horizontal",
      left: "center",
      top: 5,
      textStyle: {
        color: isDark ? "#9ca3af" : "#6b7280",
        fontSize: 10,
      },
      inRange: {
        color: ["#e0f2fe", "#0ea5e9", "#0369a1"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  if (videos.length === 0 || heatmapData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">
        {t("chart.publishTimeHeatmap")}
      </p>
      <ReactECharts option={option} style={{ height: 240 }} />
    </div>
  );
}
