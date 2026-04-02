import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { SentimentDistribution } from "@/types";

interface Props {
  danmaku: SentimentDistribution | null;
  comment: SentimentDistribution | null;
}

const COLORS = { positive: "#22c55e", neutral: "#94a3b8", negative: "#ef4444" };

export default function SentimentDistributionChart({ danmaku, comment }: Props) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const makePieData = (dist: SentimentDistribution | null) => {
    if (!dist || dist.count === 0) return [];
    return [
      { name: t("sentiment.positive"), value: dist.positive_pct, itemStyle: { color: COLORS.positive } },
      { name: t("sentiment.neutral"), value: dist.neutral_pct, itemStyle: { color: COLORS.neutral } },
      { name: t("sentiment.negative"), value: dist.negative_pct, itemStyle: { color: COLORS.negative } },
    ];
  };

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
        name: t("sentiment.danmakuSentiment"),
        type: "pie",
        radius: ["35%", "60%"],
        center: ["25%", "45%"],
        data: makePieData(danmaku),
        label: {
          show: true,
          position: "center",
          formatter: danmaku && danmaku.count > 0
            ? `{a|${(danmaku.avg_score * 100).toFixed(0)}}\n{b|${t("sentiment.danmakuLabel")}}`
            : `{b|${t("common.noData")}}`,
          rich: {
            a: { fontSize: 16, fontWeight: "bold", color: isDark ? "#e5e7eb" : "#1f2937", lineHeight: 22 },
            b: { fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", lineHeight: 16 },
          },
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" } },
      },
      {
        name: t("sentiment.commentSentiment"),
        type: "pie",
        radius: ["35%", "60%"],
        center: ["75%", "45%"],
        data: makePieData(comment),
        label: {
          show: true,
          position: "center",
          formatter: comment && comment.count > 0
            ? `{a|${(comment.avg_score * 100).toFixed(0)}}\n{b|${t("sentiment.commentLabel")}}`
            : `{b|${t("common.noData")}}`,
          rich: {
            a: { fontSize: 16, fontWeight: "bold", color: isDark ? "#e5e7eb" : "#1f2937", lineHeight: 22 },
            b: { fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", lineHeight: 16 },
          },
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" } },
      },
    ],
  }), [danmaku, comment, isDark, t]);

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("sentiment.distribution")}</p>
      <ReactECharts option={option} style={{ height: 200 }} />
    </div>
  );
}
