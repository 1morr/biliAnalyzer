import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";

interface VideoWordCloudsProps {
  bvid: string;
}

function CloudImage({ src, label }: { src: string; label: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {failed ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          className="h-40 w-full rounded-lg object-contain border border-border bg-white"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function VideoWordClouds({ bvid }: VideoWordCloudsProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <CloudImage
          src={api.videoWordcloudUrl(bvid, "content")}
          label={t("chart.wordcloud.content")}
        />
        <CloudImage
          src={api.videoWordcloudUrl(bvid, "interaction")}
          label={t("chart.wordcloud.interaction")}
        />
      </div>
    </div>
  );
}
