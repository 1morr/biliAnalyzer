import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import { chartBase, categoryAxis, valueAxis, useChartTokens, NAME_SIZE } from "@/lib/chart-theme";
import { NoInk } from "@/components/proof/States";
import type { SentimentTrendPoint } from "@/types";

/**
 * 情感走勢 —— two record lines, ink for danmaku and blue pencil for comments.
 * The 50 line is where sentiment turns, so it is drawn as a rule, not implied.
 */
export default function SentimentTrendChart({
  data,
  height = 200,
}: {
  data: SentimentTrendPoint[];
  height?: number;
}) {
  const { t } = useTranslation();
  const k = useChartTokens();

  const option = useMemo(
    () => ({
      ...chartBase(k),
      tooltip: {
        ...chartBase(k).tooltip,
        trigger: "axis",
        valueFormatter: (v: number | null) => (v == null ? "—" : (v * 100).toFixed(1)),
      },
      legend: {
        data: [t("sentiment.danmakuSentiment"), t("sentiment.commentSentiment")],
        textStyle: { color: k.ink3, fontSize: NAME_SIZE, fontFamily: k.font },
        icon: "rect",
        itemWidth: 9,
        itemHeight: 9,
        right: 0,
        top: 0,
      },
      grid: { left: 30, right: 30, top: 30, bottom: 4, containLabel: true },
      xAxis: categoryAxis(k, { data: data.map((p) => p.date), boundaryGap: false }),
      yAxis: valueAxis(k, {
        min: 0,
        max: 1,
        axisLabel: {
          color: k.ink3,
          fontSize: 10,
          fontFamily: k.font,
          formatter: (v: number) => (v * 100).toFixed(0),
        },
      }),
      series: [
        {
          name: t("sentiment.danmakuSentiment"),
          type: "line",
          data: data.map((p) => p.danmaku_avg),
          connectNulls: true,
          smooth: false,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: k.ink, width: 1.5 },
          itemStyle: { color: k.ink },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: k.rule2, width: 1, type: "solid" },
            label: { show: false },
            data: [{ yAxis: 0.5 }],
          },
        },
        {
          name: t("sentiment.commentSentiment"),
          type: "line",
          data: data.map((p) => p.comment_avg),
          connectNulls: true,
          smooth: false,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: k.seq[2], width: 1.5, type: "dashed" },
          itemStyle: { color: k.seq[2] },
        },
      ],
    }),
    [data, k, t],
  );

  if (!data.length) return <NoInk className="py-10" />;

  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
}
