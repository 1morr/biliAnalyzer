import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type {
  SentimentOverview,
  SentimentTrendPoint,
  SentimentWordItem,
  DemographicSentimentCell,
} from "@/types";
import { Button } from "@/components/ui/button";
import SentimentDistributionChart from "./SentimentDistributionChart";
import SentimentTrendChart from "./SentimentTrendChart";
import SentimentWordCloud from "./SentimentWordCloud";
import DemographicSentimentMatrix from "./DemographicSentimentMatrix";

interface Props {
  queryId?: number;
  bvid?: string;
}

export default function SentimentPanel({ queryId, bvid }: Props) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<SentimentOverview | null>(null);
  const [trend, setTrend] = useState<SentimentTrendPoint[]>([]);
  const [danmakuWords, setDanmakuWords] = useState<SentimentWordItem[]>([]);
  const [commentWords, setCommentWords] = useState<SentimentWordItem[]>([]);
  const [demographics, setDemographics] = useState<DemographicSentimentCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isQuery = queryId != null;

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function fetchOverview() {
    try {
      const ov = isQuery
        ? await api.getSentimentOverview(queryId!)
        : await api.getVideoSentimentOverview(bvid!);
      setOverview(ov);
      return ov;
    } catch {
      return null;
    }
  }

  async function fetchAllData() {
    setLoading(true);
    try {
      const fetches: Promise<void>[] = [];

      if (isQuery) {
        fetches.push(
          api.getSentimentTrend(queryId!).then(setTrend).catch(() => {}),
          api.getSentimentWordcloud(queryId!, "danmaku").then(setDanmakuWords).catch(() => {}),
          api.getSentimentWordcloud(queryId!, "comment").then(setCommentWords).catch(() => {}),
          api.getSentimentDemographics(queryId!).then(setDemographics).catch(() => {}),
        );
      } else if (bvid) {
        fetches.push(
          api.getVideoSentimentWordcloud(bvid, "danmaku").then(setDanmakuWords).catch(() => {}),
          api.getVideoSentimentWordcloud(bvid, "comment").then(setCommentWords).catch(() => {}),
          api.getVideoSentimentDemographics(bvid).then(setDemographics).catch(() => {}),
        );
      }

      await Promise.all(fetches);
    } finally {
      setLoading(false);
    }
  }

  async function pollStatus() {
    const ov = await fetchOverview();
    if (ov?.status === "done") {
      clearPoll();
      await fetchAllData();
    } else if (ov?.status === "error") {
      clearPoll();
    }
  }

  useEffect(() => {
    setOverview(null);
    setTrend([]);
    setDanmakuWords([]);
    setCommentWords([]);
    setDemographics([]);
    clearPoll();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId, bvid]);

  async function handleTrigger() {
    if (!isQuery) return;
    setTriggering(true);
    try {
      await api.triggerSentimentAnalysis(queryId!);
      setOverview({ status: "analyzing", danmaku: null, comment: null });
      clearPoll();
      pollRef.current = setInterval(pollStatus, 3000);
    } catch {
      // ignore
    } finally {
      setTriggering(false);
    }
  }

  // Not analyzed yet
  if (!overview || overview.status === null) {
    if (!isQuery) return null; // Video without data: hide panel
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <p className="text-sm text-muted-foreground">{t("sentiment.notAnalyzed")}</p>
        <Button onClick={handleTrigger} disabled={triggering} size="sm">
          {triggering ? t("common.loading") : t("sentiment.runAnalysis")}
        </Button>
      </div>
    );
  }

  // Analyzing
  if (overview.status === "analyzing") {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-blue-500 animate-pulse">{t("sentiment.analyzing")}</p>
      </div>
    );
  }

  // Error
  if (overview.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <p className="text-sm text-red-500">{t("sentiment.error")}</p>
        {isQuery && (
          <Button onClick={handleTrigger} disabled={triggering} size="sm" variant="outline">
            {t("sentiment.retry")}
          </Button>
        )}
      </div>
    );
  }

  // Done — render charts
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("sentiment.title")}</h3>
        {isQuery && (
          <Button onClick={handleTrigger} disabled={triggering} size="sm" variant="ghost" className="text-xs">
            {t("sentiment.reanalyze")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SentimentDistributionChart danmaku={overview.danmaku} comment={overview.comment} />
            <SentimentWordCloud
              danmakuWords={danmakuWords}
              commentWords={commentWords}
              loading={false}
            />
          </div>

          {isQuery && trend.length > 0 && (
            <SentimentTrendChart data={trend} />
          )}

          {demographics.length > 0 && (
            <DemographicSentimentMatrix data={demographics} />
          )}
        </>
      )}
    </div>
  );
}
