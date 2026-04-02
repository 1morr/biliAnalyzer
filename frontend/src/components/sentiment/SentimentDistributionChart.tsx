import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { SentimentDistribution } from "@/types";

interface Props {
  dist: SentimentDistribution | null;
  label: string;
  source: string;
  onSegmentClick?: (label: string, source: string) => void;
}

const COLORS = { positive: "#22c55e", neutral: "#94a3b8", negative: "#ef4444" };

export function combineDistributions(
  danmaku: SentimentDistribution | null,
  comment: SentimentDistribution | null,
): SentimentDistribution | null {
  const d = danmaku && danmaku.count > 0 ? danmaku : null;
  const c = comment && comment.count > 0 ? comment : null;
  if (!d && !c) return null;
  if (!d) return c;
  if (!c) return d;
  const total = d.count + c.count;
  return {
    avg_score: (d.avg_score * d.count + c.avg_score * c.count) / total,
    positive_pct: Math.round((d.positive_pct * d.count + c.positive_pct * c.count) / total * 10) / 10,
    neutral_pct: Math.round((d.neutral_pct * d.count + c.neutral_pct * c.count) / total * 10) / 10,
    negative_pct: Math.round((d.negative_pct * d.count + c.negative_pct * c.count) / total * 10) / 10,
    count: total,
  };
}

export default function SentimentDistributionChart({ dist, label, source, onSegmentClick }: Props) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const pieData = useMemo(() => {
    if (!dist || dist.count === 0) return [];
    return [
      { name: t("sentiment.positive"), value: dist.positive_pct, labelKey: "positive", itemStyle: { color: COLORS.positive } },
      { name: t("sentiment.neutral"), value: dist.neutral_pct, labelKey: "neutral", itemStyle: { color: COLORS.neutral } },
      { name: t("sentiment.negative"), value: dist.negative_pct, labelKey: "negative", itemStyle: { color: COLORS.negative } },
    ];
  }, [dist, t]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number }) => `${p.name}: ${p.value}%`,
    },
    legend: {
      bottom: 0,
      textStyle: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
      data: [t("sentiment.positive"), t("sentiment.neutral"), t("sentiment.negative")],
    },
    series: [
      {
        type: "pie",
        radius: ["35%", "60%"],
        center: ["50%", "45%"],
        data: pieData,
        label: {
          show: true,
          position: "center",
          formatter: dist && dist.count > 0
            ? `{a|${(dist.avg_score * 100).toFixed(0)}}{c|分}\n{b|${label}}`
            : `{b|${t("common.noData")}}`,
          rich: {
            a: { fontSize: 16, fontWeight: "bold", color: isDark ? "#e5e7eb" : "#1f2937", lineHeight: 22 },
            b: { fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", lineHeight: 16 },
            c: { fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", lineHeight: 22 },
          },
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" } },
      },
    ],
  }), [dist, pieData, label, isDark, t]);

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <ReactECharts
        option={option}
        style={{ height: 200 }}
        onEvents={{
          click: (params: { data?: { labelKey?: string } }) => {
            if (!onSegmentClick || !params.data?.labelKey) return;
            onSegmentClick(params.data.labelKey, source);
          },
        }}
      />
    </div>
  );
}
