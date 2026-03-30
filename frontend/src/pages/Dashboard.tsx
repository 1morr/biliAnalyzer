import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { QueryDetail, StatsSummary, VideoSummary } from "@/types";
import { useDashboardContext } from "@/components/layout/AppLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import ViewsTrendChart from "@/components/dashboard/ViewsTrendChart";
import InteractionChart from "@/components/dashboard/InteractionChart";
import ScatterChart from "@/components/dashboard/ScatterChart";
import WordCloudGrid from "@/components/dashboard/WordCloudGrid";
import VideoList from "@/components/dashboard/VideoList";
import AIPanel from "@/components/dashboard/AIPanel";

export default function Dashboard() {
  const { t } = useTranslation();
  const { queryId: queryIdStr } = useParams<{ queryId?: string }>();
  const queryId = queryIdStr ? Number(queryIdStr) : null;

  const { setQueryDetail, setOnAiClick } = useDashboardContext();

  const [detail, setDetail] = useState<QueryDetail | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [allVideos, setAllVideos] = useState<VideoSummary[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function fetchDetail(id: number) {
    try {
      const d = await api.getQuery(id);
      setDetail(d);
      setQueryDetail(d);

      if (d.status === "done") {
        clearPoll();
        // Fetch stats and a page of videos for scatter chart
        const [s, vPage] = await Promise.all([
          api.getStatsSummary(id),
          api.getVideos(id, { sort_by: "views", order: "desc", page: "1", page_size: "100" }),
        ]);
        setStats(s);
        setAllVideos(vPage.items);
      } else if (d.status === "error") {
        clearPoll();
        setErrorMsg(d.error_message ?? t("common.error"));
      }
    } catch {
      setErrorMsg(t("common.error"));
      clearPoll();
    }
  }

  useEffect(() => {
    if (!queryId) {
      setDetail(null);
      setStats(null);
      setAllVideos([]);
      setErrorMsg(null);
      setQueryDetail(undefined);
      setOnAiClick(undefined);
      clearPoll();
      return;
    }

    setLoadingDetail(true);
    setDetail(null);
    setStats(null);
    setAllVideos([]);
    setErrorMsg(null);

    fetchDetail(queryId).finally(() => setLoadingDetail(false));

    return () => {
      clearPoll();
      setQueryDetail(undefined);
      setOnAiClick(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId]);

  // Poll when fetching
  useEffect(() => {
    if (!queryId || !detail) return;
    if (detail.status === "fetching") {
      clearPoll();
      pollRef.current = setInterval(() => fetchDetail(queryId), 3000);
    }
    return clearPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.status, queryId]);

  // Wire AI button in TopBar
  useEffect(() => {
    if (detail?.status === "done") {
      setOnAiClick(() => setAiOpen(true));
    } else {
      setOnAiClick(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.status]);

  // No query selected
  if (!queryId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
      </div>
    );
  }

  // Loading
  if (loadingDetail && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  // Error
  if (errorMsg) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-red-500 text-sm">{errorMsg}</p>
      </div>
    );
  }

  // Still fetching
  if (detail?.status === "fetching") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-blue-500 text-sm animate-pulse">
          {detail.progress ?? t("common.loading")}
        </p>
      </div>
    );
  }

  // Done — render full dashboard
  return (
    <>
      <div className="p-4 md:p-6 flex flex-col gap-6">
        {/* Stats cards */}
        {stats && <StatsCards data={stats} />}

        {/* Charts row: trend + interaction */}
        {queryId && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <ViewsTrendChart queryId={queryId} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <InteractionChart queryId={queryId} />
            </div>
          </div>
        )}

        {/* Scatter + Word clouds */}
        {queryId && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <ScatterChart videos={allVideos} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <WordCloudGrid queryId={queryId} />
            </div>
          </div>
        )}

        {/* Video list */}
        {queryId && <VideoList queryId={queryId} />}
      </div>

      {/* AI Panel slide-over */}
      {queryId && (
        <AIPanel
          queryId={queryId}
          open={aiOpen}
          onOpenChange={setAiOpen}
        />
      )}
    </>
  );
}
