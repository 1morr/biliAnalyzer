import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import "echarts-wordcloud";
import type { WordFrequencyItem } from "@/types";

interface WordCloudChartProps {
  words: WordFrequencyItem[];
  loading: boolean;
  onWordClick: (word: string) => void;
  height?: number;
}

const LIGHT_PALETTE = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#ea580c", "#0d9488", "#c026d3"];
const DARK_PALETTE = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9"];

export default function WordCloudChart({ words, loading, onWordClick, height = 160 }: WordCloudChartProps) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      show: true,
      trigger: "item" as const,
      formatter: (params: { name: string; value: number }) =>
        `<b>${params.name}</b>: ${params.value}`,
    },
    series: [{
      type: "wordCloud",
      shape: "circle",
      left: "center",
      top: "center",
      width: "90%",
      height: "90%",
      sizeRange: [12, 40],
      rotationRange: [-45, 45],
      rotationStep: 15,
      gridSize: 6,
      drawOutOfBound: false,
      layoutAnimation: true,
      textStyle: {
        fontFamily: "sans-serif",
        fontWeight: "bold",
        color: () => palette[Math.floor(Math.random() * palette.length)],
      },
      emphasis: {
        focus: "self",
        textStyle: {
          textShadowBlur: 10,
          textShadowColor: isDark ? "#000" : "#999",
        },
      },
      data: words,
    }],
  }), [words, isDark]);

  const onEvents = useMemo(() => ({
    click: (params: { name: string }) => onWordClick(params.name),
  }), [onWordClick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground" style={{ height }}>
        <span className="animate-pulse">{t("common.loading")}</span>
      </div>
    );
  }

  if (!words.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground" style={{ height }}>
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border cursor-pointer">
      <ReactECharts option={option} style={{ height }} onEvents={onEvents} />
    </div>
  );
}
