import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WordFrequencyItem, WordDetailResponse, DemographicsFilter } from "@/types";
import WordCloudChart from "@/components/shared/WordCloudChart";
import WordDetailPanel from "@/components/shared/WordDetailPanel";

interface WordCloudGridProps {
  queryId: number;
  filter?: DemographicsFilter;
}

type ContentCloudMode = "all" | "title" | "tag" | "subtitle";
type ContentCloudType = "content" | "title" | "tag" | "subtitle";
type SimpleCloudType = "user" | "comment";
type InteractionCloudMode = "all" | "danmaku" | "comment";
type InteractionCloudType = "interaction" | "danmaku" | "comment";

const CONTENT_MODE_TO_TYPE: Record<ContentCloudMode, ContentCloudType> = {
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

const INTERACTION_MODE_TO_TYPE: Record<InteractionCloudMode, InteractionCloudType> = {
  all: "interaction",
  danmaku: "danmaku",
  comment: "comment",
};

const INTERACTION_MODES: { value: InteractionCloudMode; labelKey: string }[] = [
  { value: "all", labelKey: "chart.wordcloud.mode.all" },
  { value: "danmaku", labelKey: "chart.wordcloud.mode.danmaku" },
  { value: "comment", labelKey: "chart.wordcloud.mode.comment" },
];

type QueryCloudType = ContentCloudType | InteractionCloudType | SimpleCloudType;

function QueryCloudBody({
  queryId,
  type,
  height,
  showVideoBreakdown,
  filter,
}: {
  queryId: number;
  type: QueryCloudType;
  height: number;
  showVideoBreakdown: boolean;
  filter?: DemographicsFilter;
}) {
  const [words, setWords] = useState<WordFrequencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Determine if this type should use demographic filters
  const isFilterable = type === "user" || type === "comment";
  const activeFilter = isFilterable ? filter : undefined;
  const hasFilter = activeFilter && (activeFilter.gender.length > 0 || activeFilter.vip.length > 0 || activeFilter.level.length > 0 || activeFilter.location.length > 0);
  const filterKey = hasFilter ? JSON.stringify(activeFilter) : "";

  // Debounced fetch for filter changes
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let active = true;
    const doFetch = () => {
      setLoading(true);
      api.getWordFrequency(queryId, type, hasFilter ? activeFilter : undefined)
        .then((d) => { if (active) setWords(d.words); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
    };

    if (filterKey) {
      // Debounce filter-triggered fetches
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(doFetch, 300);
    } else {
      doFetch();
    }

    return () => { active = false; clearTimeout(debounceRef.current); };
  }, [queryId, type, filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    setDetailOpen(true);
  }, []);

  const fetchDetail = useCallback(
    (w: string): Promise<WordDetailResponse> => api.getWordDetail(queryId, type, w, hasFilter ? activeFilter : undefined),
    [queryId, type, filterKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      <WordCloudChart words={words} loading={loading} onWordClick={handleWordClick} height={height} />
      <WordDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        word={selectedWord}
        fetchDetail={fetchDetail}
        showVideoBreakdown={showVideoBreakdown}
        countLabelMode="occurrences"
      />
    </>
  );
}

function ContentCloudPanel({ queryId }: { queryId: number }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ContentCloudMode>("all");
  const type = CONTENT_MODE_TO_TYPE[mode];

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
            <ToggleGroupItem key={value} value={value}>{t(labelKey)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <QueryCloudBody
        key={`${queryId}-${type}`}
        queryId={queryId}
        type={type}
        height={240}
        showVideoBreakdown={true}
      />
    </div>
  );
}

function CloudPanel({ queryId, type, labelKey, filter }: { queryId: number; type: SimpleCloudType; labelKey: string; filter?: DemographicsFilter }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t(labelKey)}</p>
      <QueryCloudBody
        key={`${queryId}-${type}`}
        queryId={queryId}
        type={type}
        height={240}
        showVideoBreakdown={true}
        filter={filter}
      />
    </div>
  );
}

function InteractionCloudPanel({ queryId }: { queryId: number }) {
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
      <QueryCloudBody
        key={`${queryId}-${type}`}
        queryId={queryId}
        type={type}
        height={240}
        showVideoBreakdown={true}
      />
    </div>
  );
}

export default function WordCloudGrid({ queryId, filter }: WordCloudGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CloudPanel queryId={queryId} type="user" labelKey="chart.wordcloud.user" filter={filter} />
      <CloudPanel queryId={queryId} type="comment" labelKey="chart.wordcloud.comment" filter={filter} />
      <ContentCloudPanel queryId={queryId} />
      <InteractionCloudPanel queryId={queryId} />
    </div>
  );
}
