import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Column } from "@/components/proof/Sheet";
import WordTable from "@/components/shared/WordTable";
import WordDetailPanel from "@/components/shared/WordDetailPanel";
import type { WordFrequencyItem, WordDetailResponse, DemographicsFilter } from "@/types";
import { isFilterEmpty } from "@/types";

const BASE_SOURCES = [
  { value: "content", labelKey: "chart.wordcloud.mode.all" },
  { value: "title", labelKey: "chart.wordcloud.mode.title" },
  { value: "tag", labelKey: "chart.wordcloud.mode.tag" },
  { value: "danmaku", labelKey: "chart.wordcloud.mode.danmaku" },
  { value: "comment", labelKey: "chart.wordcloud.mode.comment" },
  { value: "user", labelKey: "chart.wordcloud.user" },
];

const FILTERABLE = ["comment", "user"];

/** 詞表（單篇）—— one table behind one switch, as on the dashboard sheet. */
export default function VideoWordTables({
  bvid,
  hasSubtitle,
  filter,
}: {
  bvid: string;
  hasSubtitle: boolean;
  filter?: DemographicsFilter;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState<string>("content");
  const [words, setWords] = useState<WordFrequencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const sources = useMemo(() => {
    if (!hasSubtitle) return BASE_SOURCES;
    const next = [...BASE_SOURCES];
    next.splice(3, 0, { value: "subtitle", labelKey: "chart.wordcloud.mode.subtitle" });
    return next;
  }, [hasSubtitle]);

  const activeFilter = FILTERABLE.includes(source) ? filter : undefined;
  const hasFilter = activeFilter && !isFilterEmpty(activeFilter);
  const filterKey = useMemo(
    () => (hasFilter ? JSON.stringify(activeFilter) : ""),
    [hasFilter, activeFilter],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let active = true;
    const doFetch = () => {
      setLoading(true);
      api
        .getVideoWordFrequency(bvid, source, hasFilter ? activeFilter : undefined)
        .then((d) => { if (active) setWords(d.words); })
        .catch(() => { if (active) setWords([]); })
        .finally(() => { if (active) setLoading(false); });
    };

    if (filterKey) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(doFetch, 300);
    } else {
      doFetch();
    }

    return () => { active = false; clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bvid, source, filterKey]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    setDetailOpen(true);
  }, []);

  const fetchDetail = useCallback(
    (w: string): Promise<WordDetailResponse> =>
      api.getVideoWordDetail(bvid, source, w, hasFilter ? activeFilter : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bvid, source, filterKey],
  );

  return (
    <Column
      label={t("chart.wordcloud.source_label")}
      action={
        <ToggleGroup
          value={[source]}
          onValueChange={(vals: string[]) => vals.length && setSource(vals[0])}
          variant="outline"
        >
          {sources.map(({ value, labelKey }) => (
            <ToggleGroupItem key={value} value={value} size="sm">
              {t(labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <WordTable words={words} loading={loading} onWordClick={handleWordClick} limit={24} />
      <WordDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        word={selectedWord}
        fetchDetail={fetchDetail}
        showVideoBreakdown={false}
        countLabelMode={source === "user" ? "uniqueUsers" : "occurrences"}
      />
    </Column>
  );
}
