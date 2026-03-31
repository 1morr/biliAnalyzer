import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WordFrequencyItem, WordDetailResponse } from "@/types";
import WordCloudChart from "@/components/shared/WordCloudChart";
import WordDetailPanel from "@/components/shared/WordDetailPanel";

interface VideoWordCloudsProps {
  bvid: string;
  hasSubtitle: boolean;
}

type ContentCloudMode = "all" | "title" | "tag" | "subtitle";
type VideoContentCloudType = "content" | "title" | "tag" | "subtitle";
type InteractionCloudMode = "all" | "danmaku" | "comment";
type VideoInteractionCloudType = "interaction" | "danmaku" | "comment";
type VideoCloudType = "user" | "location";

interface CloudDef {
  type: VideoCloudType;
  labelKey: string;
}

const CONTENT_MODE_TO_TYPE: Record<ContentCloudMode, VideoContentCloudType> = {
  all: "content",
  title: "title",
  tag: "tag",
  subtitle: "subtitle",
};

const CONTENT_MODES: { value: ContentCloudMode; labelKey: string }[] = [
  { value: "all", labelKey: "chart.wordcloud.mode.all" },
  { value: "title", labelKey: "chart.wordcloud.mode.title" },
  { value: "tag", labelKey: "chart.wordcloud.mode.tag" },
  { value: "subtitle", labelKey: "chart.wordcloud.mode.subtitle" },
];

const INTERACTION_MODE_TO_TYPE: Record<InteractionCloudMode, VideoInteractionCloudType> = {
  all: "interaction",
  danmaku: "danmaku",
  comment: "comment",
};

const INTERACTION_MODES: { value: InteractionCloudMode; labelKey: string }[] = [
  { value: "all", labelKey: "chart.wordcloud.mode.all" },
  { value: "danmaku", labelKey: "chart.wordcloud.mode.danmaku" },
  { value: "comment", labelKey: "chart.wordcloud.mode.comment" },
];

const CLOUDS: CloudDef[] = [
  { type: "user", labelKey: "chart.wordcloud.user" },
  { type: "location", labelKey: "chart.wordcloud.location" },
];

type VideoResolvedContentMode = ContentCloudMode | "disabled-subtitle";
type VideoResolvedContentType = VideoContentCloudType | "content";
type VideoAnyCloudType = VideoResolvedContentType | VideoInteractionCloudType | VideoCloudType;

function VideoCloudBody({
  bvid,
  type,
  height,
}: {
  bvid: string;
  type: VideoAnyCloudType;
  height: number;
}) {
  const [words, setWords] = useState<WordFrequencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let active = true;
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
    <>
      <WordCloudChart words={words} loading={loading} onWordClick={handleWordClick} height={height} />
      <WordDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        word={selectedWord}
        fetchDetail={fetchDetail}
        showVideoBreakdown={false}
      />
    </>
  );
}

function ContentCloudPanel({ bvid, hasSubtitle }: { bvid: string; hasSubtitle: boolean }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ContentCloudMode>("all");
  const resolvedMode: VideoResolvedContentMode = !hasSubtitle && mode === "subtitle" ? "disabled-subtitle" : mode;
  const type = resolvedMode === "disabled-subtitle" ? "content" : CONTENT_MODE_TO_TYPE[resolvedMode];

  const handleModeChange = useCallback((values: string[]) => {
    if (values.length === 0) return;
    setMode(values[0] as ContentCloudMode);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("chart.wordcloud.content")}</p>
        <ToggleGroup value={[mode]} onValueChange={handleModeChange} variant="outline">
          {CONTENT_MODES.map(({ value, labelKey }) => (
            <ToggleGroupItem key={value} value={value} disabled={value === "subtitle" && !hasSubtitle}>{t(labelKey)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <VideoCloudBody
        key={`${bvid}-${type}`}
        bvid={bvid}
        type={type}
        height={160}
      />
    </div>
  );
}

function InteractionCloudPanel({ bvid }: { bvid: string }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InteractionCloudMode>("all");
  const type = INTERACTION_MODE_TO_TYPE[mode];

  const handleModeChange = useCallback((values: string[]) => {
    if (values.length === 0) return;
    setMode(values[0] as InteractionCloudMode);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("chart.wordcloud.interaction")}</p>
        <ToggleGroup value={[mode]} onValueChange={handleModeChange} variant="outline">
          {INTERACTION_MODES.map(({ value, labelKey }) => (
            <ToggleGroupItem key={value} value={value}>{t(labelKey)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <VideoCloudBody
        key={`${bvid}-${type}`}
        bvid={bvid}
        type={type}
        height={160}
      />
    </div>
  );
}

function CloudPanel({ bvid, type, labelKey }: { bvid: string; type: VideoCloudType; labelKey: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t(labelKey)}</p>
      <VideoCloudBody
        key={`${bvid}-${type}`}
        bvid={bvid}
        type={type}
        height={160}
      />
    </div>
  );
}

export default function VideoWordClouds({ bvid, hasSubtitle }: VideoWordCloudsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ContentCloudPanel bvid={bvid} hasSubtitle={hasSubtitle} />
      <InteractionCloudPanel bvid={bvid} />
      {CLOUDS.map(({ type, labelKey }) => (
        <CloudPanel key={type} bvid={bvid} type={type} labelKey={labelKey} />
      ))}
    </div>
  );
}
