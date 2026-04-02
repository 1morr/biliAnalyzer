import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { DemographicSentimentCell } from "@/types";

interface Props {
  data: DemographicSentimentCell[];
  onCellClick?: (dimension: string, category: string) => void;
}

const DIMENSION_ORDER = ["gender", "level", "vip", "location"];
const COLORS = { positive: "#22c55e", neutral: "#94a3b8", negative: "#ef4444" };

export default function DemographicSentimentMatrix({ data, onCellClick }: Props) {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  const grouped = useMemo(() => {
    const map = new Map<string, DemographicSentimentCell[]>();
    for (const dim of DIMENSION_ORDER) {
      const items = data
        .filter((d) => d.dimension === dim)
        .sort((a, b) => a.count - b.count);
      if (items.length > 0) map.set(dim, items);
    }
    return map;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("common.noData")}
      </div>
    );
  }

  const options = useMemo(() => {
    const charts: { dimension: string; option: object }[] = [];
    for (const [dim, items] of grouped) {
      const categories = items.map((d) => d.category);
      charts.push({
        dimension: dim,
        option: {
          backgroundColor: "transparent",
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: Array<{ name: string; seriesName: string; value: number; marker: string }>) => {
              const cat = params[0]?.name ?? "";
              const cell = items.find((d) => d.category === cat);
              if (!cell) return cat;
              let html = `<b>${cat}</b> (n=${cell.count})<br/>`;
              html += `${t("sentiment.avgScore")}: ${(cell.avg_score * 100).toFixed(1)}<br/>`;
              for (const p of params) {
                html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
              }
              return html;
            },
          },
          legend: {
            show: false,
          },
          grid: { left: 70, right: 16, top: 8, bottom: 8 },
          xAxis: {
            type: "value",
            max: 100,
            show: false,
          },
          yAxis: {
            type: "category",
            data: categories,
            axisLabel: { color: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          series: [
            {
              name: t("sentiment.positive"),
              type: "bar",
              stack: "total",
              data: items.map((d) => d.positive_pct),
              itemStyle: { color: COLORS.positive },
              barMaxWidth: 20,
            },
            {
              name: t("sentiment.neutral"),
              type: "bar",
              stack: "total",
              data: items.map((d) => d.neutral_pct),
              itemStyle: { color: COLORS.neutral },
              barMaxWidth: 20,
            },
            {
              name: t("sentiment.negative"),
              type: "bar",
              stack: "total",
              data: items.map((d) => d.negative_pct),
              itemStyle: { color: COLORS.negative },
              barMaxWidth: 20,
            },
          ],
        },
      });
    }
    return charts;
  }, [grouped, isDark, t]);

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("sentiment.demographics")}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {options.map(({ dimension, option }) => {
          const itemCount = grouped.get(dimension)?.length ?? 2;
          const chartHeight = Math.max(80, itemCount * 26 + 16);
          const isScrollable = dimension === "location" && itemCount > 8;
          return (
            <div key={dimension} className="rounded-lg border border-border p-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t(`sentiment.dim.${dimension}`)}
              </p>
              <div
                className={isScrollable ? "overflow-y-auto" : ""}
                style={isScrollable ? { maxHeight: 220 } : undefined}
              >
                <ReactECharts
                  option={option}
                  style={{ height: chartHeight }}
                  onEvents={{
                    click: (params: { name?: string }) => {
                      if (params.name && onCellClick) {
                        onCellClick(dimension, params.name);
                      }
                    },
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
