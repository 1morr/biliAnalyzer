import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Column } from "@/components/proof/Sheet";
import WordTable from "@/components/shared/WordTable";
import WordDetailPanel from "@/components/shared/WordDetailPanel";
import type { WordFrequencyItem, WordDetailResponse, DemographicsFilter } from "@/types";
import { isFilterEmpty } from "@/types";

/**
 * 詞表 —— one table, one switch. Seven near-identical tables said the same
 * thing seven times; the source is a setting, not seven separate columns.
 */

const SOURCES = [
  { value: "content", labelKey: "chart.wordcloud.mode.all" },
  { value: "title", labelKey: "chart.wordcloud.mode.title" },
  { value: "tag", labelKey: "chart.wordcloud.mode.tag" },
  { value: "subtitle", labelKey: "chart.wordcloud.mode.subtitle" },
  { value: "danmaku", labelKey: "chart.wordcloud.mode.danmaku" },
  { value: "comment", labelKey: "chart.wordcloud.mode.comment" },
  { value: "user", labelKey: "chart.wordcloud.user" },
] as const;

type Source = (typeof SOURCES)[number]["value"];

/** Only the audience-bearing sources answer to the demographic axis. */
const FILTERABLE: Source[] = ["comment", "user"];

export default function WordTableGrid({
  queryId,
  filter,
}: {
  queryId: number;
  filter?: DemographicsFilter;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>("content");
  const [words, setWords] = useState<WordFrequencyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
        .getWordFrequency(queryId, source, hasFilter ? activeFilter : undefined)
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
  }, [queryId, source, filterKey]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    setDetailOpen(true);
  }, []);

  const fetchDetail = useCallback(
    (w: string): Promise<WordDetailResponse> =>
      api.getWordDetail(queryId, source, w, hasFilter ? activeFilter : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryId, source, filterKey],
  );

  return (
    <Column
      label={t("chart.wordcloud.source_label")}
      action={
        <ToggleGroup
          value={[source]}
          onValueChange={(vals: string[]) => vals.length && setSource(vals[0] as Source)}
          variant="outline"
        >
          {SOURCES.map(({ value, labelKey }) => (
            <ToggleGroupItem key={value} value={value} size="sm">
              {t(labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <WordTable words={words} loading={loading} onWordClick={handleWordClick} limit={32} />
      <WordDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        word={selectedWord}
        fetchDetail={fetchDetail}
        showVideoBreakdown
        countLabelMode={source === "user" ? "uniqueUsers" : "occurrences"}
      />
    </Column>
  );
}
