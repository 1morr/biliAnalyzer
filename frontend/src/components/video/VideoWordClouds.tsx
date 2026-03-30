import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { WordFrequencyItem, WordDetailResponse } from "@/types";
import WordCloudChart from "@/components/shared/WordCloudChart";
import WordDetailPanel from "@/components/shared/WordDetailPanel";

interface VideoWordCloudsProps {
  bvid: string;
  hasSubtitle: boolean;
}

type VideoCloudType = "content" | "interaction" | "user";

interface CloudDef {
  type: VideoCloudType;
  labelKey: string;
}

const CLOUDS: CloudDef[] = [
  { type: "content", labelKey: "chart.wordcloud.content" },
  { type: "interaction", labelKey: "chart.wordcloud.interaction" },
  { type: "user", labelKey: "chart.wordcloud.user" },
];

function CloudPanel({ bvid, type, labelKey }: { bvid: string; type: VideoCloudType; labelKey: string }) {
  const { t } = useTranslation();
  const [words, setWords] = useState<WordFrequencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getVideoWordFrequency(bvid, type)
      .then((d) => { if (active) setWords(d.words); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bvid, type]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    setDetailOpen(true);
  }, []);

  const fetchDetail = useCallback(
    (w: string): Promise<WordDetailResponse> => api.getVideoWordDetail(bvid, type, w),
    [bvid, type],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t(labelKey)}</p>
      <WordCloudChart words={words} loading={loading} onWordClick={handleWordClick} height={160} />
      <WordDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        word={selectedWord}
        fetchDetail={fetchDetail}
        showVideoBreakdown={false}
      />
    </div>
  );
}

export default function VideoWordClouds({ bvid, hasSubtitle }: VideoWordCloudsProps) {
  const clouds = hasSubtitle ? CLOUDS : CLOUDS.filter((c) => c.type !== "content");
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {clouds.map(({ type, labelKey }) => (
          <CloudPanel key={type} bvid={bvid} type={type} labelKey={labelKey} />
        ))}
      </div>
    </div>
  );
}
