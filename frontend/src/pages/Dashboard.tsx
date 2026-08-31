import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type {
  QueryDetail,
  StatsSummary,
  UserDemographicsResponse,
  VideoSummary,
  DemographicsFilter,
} from "@/types";
import { createEmptyFilter, isFilterEmpty } from "@/types";
import { formatCount, formatExact, formatPercent } from "@/lib/format";
import Masthead from "@/components/proof/Masthead";
import { Section, Column, Columns, Colophon, InkIn } from "@/components/proof/Sheet";
import { BlankSheet, PressRun, type Stage, type StageState } from "@/components/proof/States";
import { Button } from "@/components/ui/button";
import Lede from "@/components/dashboard/Lede";
import Ledger, { type LedgerRow } from "@/components/proof/Ledger";
import ViewsTrendChart from "@/components/dashboard/ViewsTrendChart";
import InteractionChart from "@/components/dashboard/InteractionChart";
import ScatterChart from "@/components/dashboard/ScatterChart";
import DurationChart from "@/components/dashboard/DurationChart";
import PublishTimeGrid from "@/components/dashboard/PublishTimeGrid";
import WordTableGrid from "@/components/dashboard/WordTableGrid";
import VideoList from "@/components/dashboard/VideoList";
import AIPanel from "@/components/dashboard/AIPanel";
import VideoNote, { type VideoNoteRow } from "@/components/dashboard/VideoNote";
import UserDemographicsPanel from "@/components/shared/UserDemographicsPanel";
import SentimentPanel from "@/components/sentiment/SentimentPanel";

/** Ledger key -> the API sort field and the per-video figure it prints. */
const LEDGER_METRICS: Record<
  string,
  { sortBy: string; value: (v: VideoSummary) => number; percent?: boolean }
> = {
  views: { sortBy: "views", value: (v) => v.stats.views },
  likes: { sortBy: "likes", value: (v) => v.stats.likes },
  coins: { sortBy: "coins", value: (v) => v.stats.coins },
  favorites: { sortBy: "favorites", value: (v) => v.stats.favorites },
  shares: { sortBy: "shares", value: (v) => v.stats.shares },
  danmaku: { sortBy: "danmaku", value: (v) => v.stats.danmaku_count },
  comments: { sortBy: "comments", value: (v) => v.stats.comment_count },
  videos: { sortBy: "published_at", value: (v) => v.stats.views },
  rate: { sortBy: "views", value: (v) => v.stats.interaction_rate, percent: true },
};

/** 版面上被圈起來的那一項，供各欄自己上朱批。 */
type Selection =
  | { kind: "ledger"; key: string }
  | { kind: "date"; key: string }
  | { kind: "band"; key: string }
  | { kind: "slot"; key: string }
  | null;

interface NoteState {
  subject: string;
  meta?: string;
  rows: VideoNoteRow[];
  loading: boolean;
}

function sentimentStage(status: string | null | undefined): StageState {
  if (status === "done") return "done";
  if (status === "error") return "error";
  if (status === "running" || status === "processing" || status === "pending") return "running";
  return "waiting";
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { queryId: queryIdStr } = useParams<{ queryId?: string }>();
  const queryId = queryIdStr ? Number(queryIdStr) : null;

  const [detail, setDetail] = useState<QueryDetail | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [demographics, setDemographics] = useState<UserDemographicsResponse | null>(null);
  const [demographicsError, setDemographicsError] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<VideoSummary[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(() => queryIdStr !== undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [demoFilter, setDemoFilter] = useState<DemographicsFilter>(createEmptyFilter);
  const [note, setNote] = useState<NoteState | null>(null);
  // 被拉進版邊的那一項：統計欄的一格、記錄上的一天、一個時長區間或一個時段。
  // 版面上必須留下朱批，否則讀者無從知道這份批註是從哪裡拉出來的。
  const [selected, setSelected] = useState<Selection>(null);
  const navigate = useNavigate();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchDetail = useCallback(
    async (id: number) => {
      try {
        const d = await api.getQuery(id);
        setDetail(d);

        if (d.status === "done") {
          clearPoll();
          const [s, demo, page] = await Promise.all([
            api.getStatsSummary(id),
            api
              .getQueryDemographics(id)
              .then((result) => ({ result, error: null as string | null }))
              .catch(() => ({ result: null, error: t("common.error") })),
            api.getVideos(id, {
              sort_by: "views",
              order: "desc",
              page: "1",
              page_size: "100",
            }),
          ]);
          setStats(s);
          setDemographics(demo.result);
          setDemographicsError(demo.error);
          setAllVideos(page.items);
        } else if (d.status === "error") {
          clearPoll();
          setErrorMsg(d.error_message ?? t("common.error"));
        }
      } catch {
        setErrorMsg(t("common.error"));
        clearPoll();
      }
    },
    [clearPoll, t],
  );

  useEffect(() => {
    if (!queryId) return;
    // Fetching on mount and storing the result is what this effect is for; the
    // lint rule cannot see that every setState happens in an async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetail(queryId).finally(() => setLoadingDetail(false));
    return clearPoll;
  }, [queryId, fetchDetail, clearPoll]);

  useEffect(() => {
    if (!queryId || !detail) return;
    if (detail.status === "fetching" || detail.status === "fetching_content") {
      clearPoll();
      pollRef.current = setInterval(() => fetchDetail(queryId), 3000);
    }
    return clearPoll;
  }, [detail, detail?.status, queryId, fetchDetail, clearPoll]);

  const stages = useMemo<Stage[]>(() => {
    if (!detail) return [];
    const s = detail.status;
    const failed = s === "error";
    return [
      {
        key: "index",
        label: t("press.stage.index"),
        state: failed ? "error" : s === "fetching" ? "running" : "done",
        detail: s === "fetching" ? detail.progress : null,
      },
      {
        key: "content",
        label: t("press.stage.content"),
        state: failed
          ? "waiting"
          : s === "fetching_content"
            ? "running"
            : s === "done"
              ? "done"
              : "waiting",
        detail: s === "fetching_content" ? detail.progress : null,
      },
      {
        key: "sentiment",
        label: t("press.stage.sentiment"),
        state: s === "done" ? sentimentStage(detail.sentiment_status) : "waiting",
      },
    ];
  }, [detail, t]);

  const mastheadMeta = useMemo(() => {
    if (!detail) return [];
    return [
      { label: "UID", value: String(detail.uid) },
      { label: t("masthead.span"), value: `${detail.start_date} — ${detail.end_date}` },
      {
        label: t("stats.videos"),
        value: formatExact(detail.video_count, lang),
      },
      ...(detail.status === "done"
        ? [{ label: t("stats.totalViews"), value: formatCount(detail.total_views, lang) }]
        : []),
    ];
  }, [detail, t, lang]);

  /** Everything the sheet aggregates can be pulled back apart into videos. */
  const openVideoNote = useCallback(
    (subject: string, meta: string | undefined, rows: VideoNoteRow[]) => {
      setNote({ subject, meta, rows, loading: false });
    },
    [],
  );

  const noteFromSet = useCallback(
    (
      subject: string,
      meta: string | undefined,
      pick: (v: VideoSummary) => boolean,
      mark: Selection = null,
    ) => {
      setSelected(mark);
      const rows = allVideos
        .filter(pick)
        .sort((a, b) => b.stats.views - a.stats.views)
        .slice(0, 20)
        .map((v) => ({ video: v, figure: formatCount(v.stats.views, lang) }));
      openVideoNote(subject, meta, rows);
    },
    [allVideos, lang, openVideoNote],
  );

  const handleLedgerClick = useCallback(
    async (row: LedgerRow) => {
      const metric = LEDGER_METRICS[row.key];
      if (!queryId || !metric) return;
      setSelected({ kind: "ledger", key: row.key });
      setNote({ subject: row.label, meta: t("note.topTen"), rows: [], loading: true });
      try {
        const page = await api.getVideos(queryId, {
          sort_by: metric.sortBy,
          order: "desc",
          page: "1",
          page_size: "10",
        });
        setNote({
          subject: row.label,
          meta: t("note.topTen"),
          loading: false,
          rows: page.items.map((v) => ({
            video: v,
            figure: metric.percent
              ? formatPercent(metric.value(v))
              : formatCount(metric.value(v), lang),
          })),
        });
      } catch {
        setNote({ subject: row.label, meta: t("common.error"), rows: [], loading: false });
      }
    },
    [queryId, t, lang],
  );

  const ledgerRows = useMemo<LedgerRow[]>(() => {
    if (!stats) return [];
    const rows: [string, string, number][] = [
      ["views", t("stats.totalViews"), stats.total_views],
      ["likes", t("stats.likes"), stats.total_likes],
      ["coins", t("stats.coins"), stats.total_coins],
      ["favorites", t("stats.favorites"), stats.total_favorites],
      ["shares", t("stats.shares"), stats.total_shares],
      ["danmaku", t("stats.danmaku"), stats.total_danmaku],
      ["comments", t("stats.comments"), stats.total_comments],
      ["videos", t("stats.videos"), stats.video_count],
    ];
    return rows.map(([key, label, value]) => ({
      key,
      label,
      value: formatCount(value, lang),
      exact: formatExact(value, lang),
      open: selected?.kind === "ledger" && selected.key === key,
    }));
  }, [stats, t, lang, selected]);

  const printRun = useMemo(() => {
    if (isFilterEmpty(demoFilter)) return null;
    const parts = [
      ...demoFilter.gender,
      ...demoFilter.vip,
      ...demoFilter.level,
      ...demoFilter.location,
    ];
    return t("masthead.printRun", { filters: parts.join("、") });
  }, [demoFilter, t]);

  if (!queryId) {
    return <BlankSheet title={t("blank.title")} note={t("blank.note")} />;
  }

  if (loadingDetail && !detail) {
    return <BlankSheet title={t("common.loading")} note={t("blank.loadingNote")} />;
  }

  const title = detail?.user_name || (detail ? `UID ${detail.uid}` : t("app.title"));

  if (errorMsg) {
    return (
      <>
        <Masthead title={title} meta={mastheadMeta} />
        <div className="flex flex-col gap-8 px-4 pt-6 pb-16 md:px-8">
          <div className="rule-double pt-5">
            <p className="font-song text-h3 font-semibold text-mark">{t("press.failedTitle")}</p>
            <p className="prose-cn mt-2 max-w-[46ch] text-body leading-[1.9] text-ink-2">
              {errorMsg}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => queryId && fetchDetail(queryId)}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
          {/* 工序表：讀者要看得出是哪一道斷了，而不是只讀到「出錯了」。 */}
          {stages.length > 0 && (
            <div className="max-w-xl">
              <PressRun stages={stages} />
            </div>
          )}
        </div>
      </>
    );
  }

  if (detail && (detail.status === "fetching" || detail.status === "fetching_content")) {
    return (
      <>
        <Masthead title={title} meta={mastheadMeta} />
        <div className="flex flex-col px-4 pt-6 pb-16 md:px-8">
          <div className="rule-double max-w-xl pt-5">
            <PressRun stages={stages} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Masthead
        title={title}
        meta={mastheadMeta}
        actions={
          detail?.status === "done" ? (
            <Button variant="default" onClick={() => setAiOpen(true)}>
              {t("ai.analyze")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-10 px-4 pt-6 pb-16 md:px-8">
        {/* 導言 + 播放量記錄 */}
        {detail && stats && (
          <InkIn className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* 兩欄共用同一條起始線：導言與記錄各自從欄標題下方起排。 */}
            <Column label={t("lede.label")}>
              <Lede detail={detail} stats={stats} videos={allVideos} />
            </Column>
            <Column label={t("chart.viewsTrend")}>
              <ViewsTrendChart
                queryId={queryId}
                height={186}
                selectedDate={selected?.kind === "date" ? selected.key : null}
                onPointClick={(date) =>
                  noteFromSet(
                    date,
                    t("note.publishedOn"),
                    (v) => Boolean(v.published_at?.startsWith(date)),
                    { kind: "date", key: date },
                  )
                }
              />
            </Column>
          </InkIn>
        )}

        {stats && (
          <InkIn delay={60}>
            <Ledger rows={ledgerRows} onFigureClick={handleLedgerClick} />
          </InkIn>
        )}

        <Section label={t("section.performance")}>
          <Columns className="lg:grid-cols-3">
            <Column label={t("chart.interaction")}>
              <InteractionChart queryId={queryId} />
            </Column>
            <Column label={t("chart.scatter")} action={<ScatterNote />}>
              <ScatterChart
                videos={allVideos}
                onVideoClick={(bvid) => navigate(`/video/${bvid}?query=${queryId}`)}
              />
            </Column>
            <Column label={t("chart.durationImpact")}>
              <DurationChart
                videos={allVideos}
                selectedBand={selected?.kind === "band" ? selected.key : null}
                onBandClick={(band) =>
                  noteFromSet(
                    band.label,
                    t("note.inBand"),
                    (v) => v.duration >= band.min && v.duration < band.max,
                    { kind: "band", key: band.label },
                  )
                }
              />
            </Column>
          </Columns>
          <div className="mt-8">
            <Column label={t("chart.publishTimeHeatmap")}>
              <PublishTimeGrid
                videos={allVideos}
                selectedSlot={selected?.kind === "slot" ? selected.key : null}
                onCellClick={(slot) =>
                  noteFromSet(
                    slot.label,
                    t("note.inSlot"),
                    (v) => {
                      if (!v.published_at) return false;
                      const d = new Date(v.published_at);
                      return d.getDay() === slot.day && d.getHours() === slot.hour;
                    },
                    { kind: "slot", key: `${slot.day}-${slot.hour}` },
                  )
                }
              />
            </Column>
          </div>
        </Section>

        {(demographics || demographicsError) && (
          <Section label={t("section.audience")}>
            <UserDemographicsPanel
              data={demographics}
              error={demographicsError}
              filter={demoFilter}
              onFilterChange={setDemoFilter}
            />
          </Section>
        )}

        <Section label={t("section.words")}>
          <WordTableGrid queryId={queryId} filter={demoFilter} />
        </Section>

        {detail?.status === "done" && (
          <Section label={t("section.sentiment")}>
            <SentimentPanel key={queryId} queryId={queryId} />
          </Section>
        )}

        <Section label={t("section.catalogue")}>
          <VideoList queryId={queryId} />
        </Section>

        <Colophon
          items={[
            detail ? `${t("colophon.query")} #${detail.id}` : null,
            detail?.created_at ? `${t("colophon.fetched")} ${detail.created_at.slice(0, 19).replace("T", " ")}` : null,
            printRun,
          ]}
        />
      </div>

      <VideoNote
        open={note !== null}
        onOpenChange={(next) => {
          if (next) return;
          setNote(null);
          setSelected(null);
        }}
        subject={note?.subject ?? ""}
        meta={note?.meta}
        rows={note?.rows ?? []}
        loading={note?.loading ?? false}
        queryId={queryId}
      />

      <AIPanel queryId={queryId} open={aiOpen} onOpenChange={setAiOpen} />
    </>
  );
}

function ScatterNote() {
  const { t } = useTranslation();
  return <span className="text-colophon text-ink-3">{t("chart.scatterFormula")}</span>;
}
