import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { WordFrequencyItem, WordDetailResponse } from "@/types";
import WordCloudChart from "@/components/shared/WordCloudChart";
import WordDetailPanel from "@/components/shared/WordDetailPanel";

interface WordCloudGridProps {
  queryId: number;
}

type WordCloudType = "title" | "tag" | "danmaku" | "comment" | "user";

interface CloudDef {
  type: WordCloudType;
  labelKey: string;
}

const CLOUDS: CloudDef[] = [
  { type: "title", labelKey: "chart.wordcloud.title" },
  { type: "tag", labelKey: "chart.wordcloud.tag" },
  { type: "danmaku", labelKey: "chart.wordcloud.danmaku" },
  { type: "comment", labelKey: "chart.wordcloud.comment" },
  { type: "user", labelKey: "chart.wordcloud.user" },
];

function CloudPanel({ queryId, type, labelKey }: { queryId: number; type: WordCloudType; labelKey: string }) {
  const { t } = useTranslation();
  const [words, setWords] = useState<WordFrequencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getWordFrequency(queryId, type)
      .then((d) => { if (active) setWords(d.words); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryId, type]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    setDetailOpen(true);
  }, []);

  const fetchDetail = useCallback(
    (w: string): Promise<WordDetailResponse> => api.getWordDetail(queryId, type, w),
    [queryId, type],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t(labelKey)}</p>
      <WordCloudChart words={words} loading={loading} onWordClick={handleWordClick} height={144} />
      <WordDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        word={selectedWord}
        fetchDetail={fetchDetail}
        showVideoBreakdown={true}
      />
    </div>
  );
}

export default function WordCloudGrid({ queryId }: WordCloudGridProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {CLOUDS.map(({ type, labelKey }) => (
          <CloudPanel key={type} queryId={queryId} type={type} labelKey={labelKey} />
        ))}
      </div>
    </div>
  );
}
