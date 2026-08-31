import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAP } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type {
  SentimentOverview,
  SentimentTrendPoint,
  SentimentWordItem,
  DemographicSentimentCell,
  SentimentContextResponse,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Column } from "@/components/proof/Sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Inking } from "@/components/proof/States";
import SentimentRule from "./SentimentRule";
import { combineDistributions } from "@/lib/sentiment";
import SentimentTrendChart from "./SentimentTrendChart";
import SentimentMatrix from "./SentimentMatrix";
import SentimentContextPanel from "./SentimentContextPanel";
import SentimentWords from "./SentimentWords";

interface Props {
  queryId?: number;
  bvid?: string;
}

const EMPTY_CONTEXT: SentimentContextResponse = { total_count: 0, items: [] };

export default function SentimentPanel({ queryId, bvid }: Props) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<SentimentOverview | null>(null);
  const [trend, setTrend] = useState<SentimentTrendPoint[]>([]);
  const [allWords, setAllWords] = useState<SentimentWordItem[]>([]);
  const [danmakuWords, setDanmakuWords] = useState<SentimentWordItem[]>([]);
  const [commentWords, setCommentWords] = useState<SentimentWordItem[]>([]);
  const [demographics, setDemographics] = useState<DemographicSentimentCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [source, setSource] = useState("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [contextTitle, setContextTitle] = useState("");
  const [contextSubtitle, setContextSubtitle] = useState<string | undefined>();
  const [contextWord, setContextWord] = useState<string | undefined>();
  const [contextFetcher, setContextFetcher] = useState<() => Promise<SentimentContextResponse>>(
    () => () => Promise.resolve(EMPTY_CONTEXT),
  );

  const isQuery = queryId != null;

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const ov = isQuery
        ? await api.getSentimentOverview(queryId!)
        : await api.getVideoSentimentOverview(bvid!);
      setOverview(ov);
      return ov;
    } catch {
      return null;
    }
  }, [isQuery, queryId, bvid]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const jobs: Promise<unknown>[] = [];
      if (isQuery) {
        jobs.push(
          api.getSentimentTrend(queryId!).then(setTrend).catch(() => {}),
          api.getSentimentWordcloud(queryId!, "all").then(setAllWords).catch(() => {}),
          api.getSentimentWordcloud(queryId!, "danmaku").then(setDanmakuWords).catch(() => {}),
          api.getSentimentWordcloud(queryId!, "comment").then(setCommentWords).catch(() => {}),
          api.getSentimentDemographics(queryId!).then(setDemographics).catch(() => {}),
        );
      } else if (bvid) {
        jobs.push(
          api.getVideoSentimentWordcloud(bvid, "all").then(setAllWords).catch(() => {}),
          api.getVideoSentimentWordcloud(bvid, "danmaku").then(setDanmakuWords).catch(() => {}),
          api.getVideoSentimentWordcloud(bvid, "comment").then(setCommentWords).catch(() => {}),
          api.getVideoSentimentDemographics(bvid).then(setDemographics).catch(() => {}),
        );
      }
      await Promise.all(jobs);
    } finally {
      setLoading(false);
    }
  }, [isQuery, queryId, bvid]);

  const pollStatus = useCallback(async () => {
    const ov = await fetchOverview();
    if (ov?.status === "done") {
      clearPoll();
      await fetchAllData();
    } else if (ov?.status === "error") {
      clearPoll();
    }
  }, [fetchOverview, fetchAllData, clearPoll]);

  useEffect(() => {
    if (!queryId && !bvid) return;

    (async () => {
      const ov = await fetchOverview();
      if (ov?.status === "done") {
        await fetchAllData();
      } else if (ov?.status === "analyzing") {
        pollRef.current = setInterval(pollStatus, 3000);
      }
    })();

    return clearPoll;
  }, [queryId, bvid, fetchOverview, fetchAllData, pollStatus, clearPoll]);

  async function handleTrigger() {
    if (!isQuery) return;
    setTriggering(true);
    try {
      await api.triggerSentimentAnalysis(queryId!);
      setOverview({ status: "analyzing", danmaku: null, comment: null });
      clearPoll();
      pollRef.current = setInterval(pollStatus, 3000);
    } catch {
      setOverview({ status: "error", danmaku: null, comment: null });
    } finally {
      setTriggering(false);
    }
  }

  const openContext = useCallback(
    (
      title: string,
      params: Record<string, string>,
      opts: { subtitle?: string; word?: string } = {},
    ) => {
      setContextTitle(title);
      setContextSubtitle(opts.subtitle);
      setContextWord(opts.word);
      setContextFetcher(() => () =>
        isQuery
          ? api.getSentimentContexts(queryId!, params)
          : api.getVideoSentimentContexts(bvid!, params),
      );
      setContextOpen(true);
    },
    [isQuery, queryId, bvid],
  );

  const wordHandler = useCallback(
    (source: string) => (word: string) =>
      openContext(word, source === "all" ? { word } : { word, source }, {
        subtitle: source !== "all" ? t(`chart.wordcloud.source.${source}`) : undefined,
        word,
      }),
    [openContext, t],
  );

  const segmentHandler = useCallback(
    (label: string, source: string) =>
      openContext(t(`sentiment.${label}`), source === "all" ? { label } : { label, source }, {
        subtitle: source !== "all" ? t(`chart.wordcloud.source.${source}`) : undefined,
      }),
    [openContext, t],
  );

  const cellHandler = useCallback(
    (dimension: string, category: string) =>
      openContext(`${t(`sentiment.dim.${dimension}`)}${GAP}${category}`, { dimension, category }),
    [openContext, t],
  );

  const combined = useMemo(
    () => combineDistributions(overview?.danmaku ?? null, overview?.comment ?? null),
    [overview?.danmaku, overview?.comment],
  );

  if (!overview || overview.status === null) {
    if (!isQuery) return null;
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-note text-ink-2">{t("sentiment.notAnalyzed")}</p>
        <Button size="sm" onClick={handleTrigger} disabled={triggering}>
          {triggering ? t("common.loading") : t("sentiment.runAnalysis")}
        </Button>
      </div>
    );
  }

  if (overview.status === "analyzing") {
    return <p className="animate-pulse py-6 text-note text-pencil">{t("sentiment.analyzing")}</p>;
  }

  if (overview.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-note text-mark">{t("sentiment.error")}</p>
        {isQuery && (
          <Button size="sm" variant="outline" onClick={handleTrigger} disabled={triggering}>
            {t("sentiment.retry")}
          </Button>
        )}
      </div>
    );
  }

  const sources = [
    { key: "all", label: t("chart.wordcloud.mode.all"), dist: combined, words: allWords },
    { key: "danmaku", label: t("sentiment.danmakuLabel"), dist: overview.danmaku, words: danmakuWords },
    { key: "comment", label: t("sentiment.commentLabel"), dist: overview.comment, words: commentWords },
  ];
  const current = sources.find((s) => s.key === source) ?? sources[0];

  return (
    <div className="flex flex-col gap-8">
      {loading ? (
        <Inking className="py-12" />
      ) : (
        <>
          <Column
            label={t("sentiment.distribution")}
            action={
              <ToggleGroup
                value={[source]}
                onValueChange={(vals: string[]) => vals.length && setSource(vals[0])}
                variant="outline"
              >
                {sources.map((s) => (
                  <ToggleGroupItem key={s.key} value={s.key} size="sm">
                    {s.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
          >
            <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
              <SentimentRule
                dist={current.dist}
                source={current.key}
                onSegmentClick={segmentHandler}
              />
              <SentimentWords words={current.words} onWordClick={wordHandler(current.key)} />
            </div>
          </Column>

          {isQuery && trend.length > 0 && (
            <Column label={t("sentiment.trend")}>
              <SentimentTrendChart data={trend} />
            </Column>
          )}

          {demographics.length > 0 && (
            <SentimentMatrix data={demographics} onCellClick={cellHandler} />
          )}

          {isQuery && (
            <div className="flex justify-end border-t border-rule pt-3">
              <Button size="sm" variant="ghost" onClick={handleTrigger} disabled={triggering}>
                {t("sentiment.reanalyze")}
              </Button>
            </div>
          )}
        </>
      )}

      <SentimentContextPanel
        open={contextOpen}
        onOpenChange={setContextOpen}
        title={contextTitle}
        subtitle={contextSubtitle}
        highlightWord={contextWord}
        fetchContexts={contextFetcher}
      />
    </div>
  );
}
