import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";

interface WordCloudGridProps {
  queryId: number;
}

type WordCloudType = "title" | "tag" | "danmaku" | "comment";

interface CloudDef {
  type: WordCloudType;
  labelKey: string;
}

const CLOUDS: CloudDef[] = [
  { type: "title", labelKey: "chart.wordcloud.title" },
  { type: "tag", labelKey: "chart.wordcloud.tag" },
  { type: "danmaku", labelKey: "chart.wordcloud.danmaku" },
  { type: "comment", labelKey: "chart.wordcloud.comment" },
];

function CloudImage({ src, label }: { src: string; label: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {failed ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          className="h-36 w-full rounded-lg object-contain border border-border bg-white"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function WordCloudGrid({ queryId }: WordCloudGridProps) {
  const { t } = useTranslation();

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">{t("chart.wordcloud.title")}</p>
      <div className="grid grid-cols-2 gap-3">
        {CLOUDS.map(({ type, labelKey }) => (
          <CloudImage
            key={type}
            src={api.wordcloudUrl(queryId, type)}
            label={t(labelKey)}
          />
        ))}
      </div>
    </div>
  );
}
