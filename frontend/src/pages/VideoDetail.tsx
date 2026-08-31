import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "lucide-react";
import { api } from "@/lib/api";
import type {
  VideoDetail,
  VideoComparison,
  UserDemographicsResponse,
  DemographicsFilter,
} from "@/types";
import { createEmptyFilter } from "@/types";
import { formatCount, formatExact, formatDuration, formatPercent } from "@/lib/format";
import Masthead from "@/components/proof/Masthead";
import Ledger, { type LedgerRow } from "@/components/proof/Ledger";
import { Section, Column, Columns, Colophon, InkIn } from "@/components/proof/Sheet";
import { BlankSheet } from "@/components/proof/States";
import { Button } from "@/components/ui/button";
import VideoHeader from "@/components/video/VideoHeader";
import RadarChart from "@/components/video/RadarChart";
import ComparisonBars from "@/components/video/ComparisonBars";
import VideoWordTables from "@/components/video/VideoWordTables";
import UserDemographicsPanel from "@/components/shared/UserDemographicsPanel";
import SentimentPanel from "@/components/sentiment/SentimentPanel";
import AIPanel from "@/components/dashboard/AIPanel";

export default function VideoDetailPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { bvid } = useParams<{ bvid: string }>();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("query") ? Number(searchParams.get("query")) : null;

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [comparison, setComparison] = useState<VideoComparison | null>(null);
  const [demographics, setDemographics] = useState<UserDemographicsResponse | null>(null);
  const [demographicsError, setDemographicsError] = useState<string | null>(null);
  const [demoFilter, setDemoFilter] = useState<DemographicsFilter>(createEmptyFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!bvid) return;

    const jobs: Promise<unknown>[] = [
      api.getVideo(bvid).then(setVideo),
      api
        .getVideoDemographics(bvid)
        .then((result) => {
          setDemographics(result);
          setDemographicsError(null);
        })
        .catch(() => {
          setDemographics(null);
          setDemographicsError(t("common.error"));
        }),
    ];

    if (queryId) {
      // Comparison needs a run to compare against; its absence is not an error.
      jobs.push(api.getComparison(bvid, queryId).then(setComparison).catch(() => {}));
    }

    Promise.all(jobs)
      .catch(() => setError(t("common.error")))
      .finally(() => setLoading(false));
  }, [bvid, queryId, t]);

  const backTo = queryId ? `/dashboard/${queryId}` : "/dashboard";

  const ledgerRows = useMemo<LedgerRow[]>(() => {
    if (!video) return [];
    const s = video.stats;
    const rows: [string, string, number][] = [
      ["views", t("stats.totalViews"), s.views],
      ["likes", t("stats.likes"), s.likes],
      ["coins", t("stats.coins"), s.coins],
      ["favorites", t("stats.favorites"), s.favorites],
      ["shares", t("stats.shares"), s.shares],
      ["danmaku", t("stats.danmaku"), s.danmaku_count],
      ["comments", t("stats.comments"), s.comment_count],
    ];
    return [
      ...rows.map(([key, label, value]) => ({
        key,
        label,
        value: formatCount(value, lang),
        exact: formatExact(value, lang),
      })),
      {
        key: "rate",
        label: t("stats.interactionRate"),
        value: formatPercent(s.interaction_rate),
        marked: true,
      },
    ];
  }, [video, t, lang]);

  if (loading) {
    return <BlankSheet title={t("common.loading")} note={t("blank.loadingNote")} />;
  }

  if (error || !video) {
    return (
      <BlankSheet
        title={t("common.error")}
        note={error ?? t("common.error")}
        action={
          <Link to={backTo}>
            <Button variant="outline" size="sm">
              {t("video.backToDashboard")}
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Masthead
        title={video.title}
        back={
          <Link
            to={backTo}
            aria-label={t("video.backToDashboard")}
            className="inline-flex items-center gap-1 border-r border-rule pr-2.5 text-note text-ink-3 no-underline hover:text-mark sm:pr-3"
          >
            <ArrowLeftIcon className="size-3" />
            <span className="hidden sm:inline">{t("video.backToDashboard")}</span>
          </Link>
        }
        meta={[
          { label: "BV", value: video.bvid },
          ...(video.published_at
            ? [{ label: t("video.publishedAt"), value: video.published_at.slice(0, 10) }]
            : []),
          { label: t("video.duration"), value: formatDuration(video.duration) },
        ]}
        actions={
          <Button variant="default" onClick={() => setAiOpen(true)}>
            {t("ai.analyze")}
          </Button>
        }
      />

      <div className="flex flex-col gap-10 px-4 pt-6 pb-16 md:px-8">
        <InkIn>
          <VideoHeader video={video} />
        </InkIn>

        <InkIn delay={60}>
          <Ledger rows={ledgerRows} />
        </InkIn>

        {comparison && (
          <Section label={t("video.comparison")}>
            <Columns className="lg:grid-cols-2">
              <Column label={t("video.shape")}>
                <RadarChart data={comparison} />
              </Column>
              <Column label={t("video.engagement")}>
                <ComparisonBars data={comparison} />
              </Column>
            </Columns>
          </Section>
        )}

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
          <VideoWordTables
            bvid={video.bvid}
            hasSubtitle={video.has_subtitle}
            filter={demoFilter}
          />
        </Section>

        <Section label={t("section.sentiment")}>
          <SentimentPanel key={video.bvid} bvid={video.bvid} />
        </Section>

        <Colophon items={[video.bvid, queryId ? `${t("colophon.query")} #${queryId}` : null]} />
      </div>

      <AIPanel
        bvid={video.bvid}
        queryId={queryId ?? undefined}
        open={aiOpen}
        onOpenChange={setAiOpen}
      />
    </>
  );
}
