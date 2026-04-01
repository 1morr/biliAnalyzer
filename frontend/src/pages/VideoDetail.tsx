import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { VideoDetail, VideoComparison, UserDemographicsResponse } from "@/types";
import VideoHeader from "@/components/video/VideoHeader";
import VideoStatsCards from "@/components/video/VideoStatsCards";
import RadarChart from "@/components/video/RadarChart";
import ComparisonBars from "@/components/video/ComparisonBars";
import VideoWordClouds from "@/components/video/VideoWordClouds";
import UserDemographicsPanel from "@/components/shared/UserDemographicsPanel";

export default function VideoDetailPage() {
  const { t } = useTranslation();
  const { bvid } = useParams<{ bvid: string }>();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("query") ? Number(searchParams.get("query")) : null;

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [comparison, setComparison] = useState<VideoComparison | null>(null);
  const [demographics, setDemographics] = useState<UserDemographicsResponse | null>(null);
  const [demographicsError, setDemographicsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bvid) return;

    setLoading(true);
    setError(null);
    setVideo(null);
    setComparison(null);
    setDemographics(null);
    setDemographicsError(null);

    const fetches: Promise<void>[] = [
      api.getVideo(bvid).then(setVideo),
      api.getVideoDemographics(bvid)
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
      fetches.push(
        api.getComparison(bvid, queryId)
          .then(setComparison)
          .catch(() => {
            // comparison may not exist; silently ignore
          })
      );
    }

    Promise.all(fetches)
      .catch(() => setError(t("common.error")))
      .finally(() => setLoading(false));
  }, [bvid, queryId, t]);

  const backTo = queryId ? `/dashboard/${queryId}` : "/dashboard";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
        <p className="text-sm text-red-500">{error ?? t("common.error")}</p>
        <Link to={backTo} className="text-sm text-blue-500 hover:underline">
          ← {t("video.backToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      {/* Breadcrumb */}
      <Link to={backTo} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        ← {t("video.backToDashboard")}
      </Link>

      {/* Video header */}
      <div className="rounded-xl border border-border bg-card p-4">
        <VideoHeader video={video} />
      </div>

      {/* Stats cards */}
      <VideoStatsCards stats={video.stats} />

      {/* Radar + Comparison bars */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <RadarChart data={comparison} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <ComparisonBars data={comparison} />
        </div>
      </div>

      {/* User demographics */}
      <div className="rounded-xl border border-border bg-card p-4">
        <UserDemographicsPanel data={demographics} error={demographicsError} />
      </div>

      {/* Word clouds */}
      <div className="rounded-xl border border-border bg-card p-4">
        <VideoWordClouds bvid={video.bvid} hasSubtitle={video.has_subtitle} />
      </div>
    </div>
  );
}
