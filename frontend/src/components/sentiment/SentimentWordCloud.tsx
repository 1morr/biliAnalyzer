import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import "echarts-wordcloud";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SentimentWordItem } from "@/types";

interface Props {
  danmakuWords: SentimentWordItem[];
  commentWords: SentimentWordItem[];
  loading: boolean;
}

function scoreToColor(score: number, isDark: boolean): string {
  // Red(0.0) → Gray(0.5) → Green(1.0)
  if (score <= 0.5) {
    const t = score / 0.5;
    const r = Math.round(239 * (1 - t) + (isDark ? 156 : 148) * t);
    const g = Math.round(68 * (1 - t) + (isDark ? 163 : 163) * t);
    const b = Math.round(68 * (1 - t) + (isDark ? 184 : 184) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (score - 0.5) / 0.5;
    const r = Math.round((isDark ? 156 : 148) * (1 - t) + 34 * t);
    const g = Math.round((isDark ? 163 : 163) * (1 - t) + 197 * t);
    const b = Math.round((isDark ? 184 : 184) * (1 - t) + 94 * t);
    return `rgb(${r},${g},${b})`;
  }
}

export default function SentimentWordCloud({ danmakuWords, commentWords, loading }: Props) {
  const { t } = useTranslation();
  const [source, setSource] = useState<string[]>(["danmaku"]);
  const isDark = document.documentElement.classList.contains("dark");

  const words = source[0] === "comment" ? commentWords : danmakuWords;

  const option = useMemo(() => {
    const colorMap = new Map(words.map((w) => [w.name, scoreToColor(w.avg_score, isDark)]));
    return {
      backgroundColor: "transparent",
      tooltip: {
        show: true,
        trigger: "item",
        formatter: (params: { name: string; value: number }) => {
          const item = words.find((w) => w.name === params.name);
          if (!item) return params.name;
          const labelText = t(`sentiment.${item.label}`);
          return `<b>${params.name}</b><br/>${t("sentiment.frequency")}: ${item.value}<br/>${t("sentiment.avgScore")}: ${(item.avg_score * 100).toFixed(1)}<br/>${t("sentiment.label")}: ${labelText}`;
        },
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
          color: (params: { name: string }) => colorMap.get(params.name) ?? "#94a3b8",
        },
        emphasis: {
          focus: "self",
          textStyle: { textShadowBlur: 10, textShadowColor: isDark ? "#000" : "#999" },
        },
        data: words.map((w) => ({ name: w.name, value: w.value })),
      }],
    };
  }, [words, isDark, t]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        <span className="animate-pulse">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t("sentiment.wordcloud")}</p>
        <ToggleGroup value={source} onValueChange={(v) => v.length > 0 && setSource(v)} size="sm">
          <ToggleGroupItem value="danmaku" className="text-xs px-2 h-7">
            {t("chart.wordcloud.danmaku")}
          </ToggleGroupItem>
          <ToggleGroupItem value="comment" className="text-xs px-2 h-7">
            {t("chart.wordcloud.comment")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {words.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 200 }} />
      )}
    </div>
  );
}
