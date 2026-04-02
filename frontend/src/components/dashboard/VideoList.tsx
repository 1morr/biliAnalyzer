import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { VideoSummary, PaginatedVideos } from "@/types";

interface VideoListProps {
  queryId: number;
}

type SortField =
  | "views"
  | "likes"
  | "coins"
  | "favorites"
  | "shares"
  | "danmaku"
  | "comments"
  | "published_at"
  | "duration";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

interface VideoRowProps {
  video: VideoSummary;
  queryId: number;
}

function VideoRow({ video, queryId }: VideoRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tags = video.tags ? video.tags.split(",").slice(0, 3) : [];

  return (
    <button
      type="button"
      onClick={() => navigate(`/video/${video.bvid}?query=${queryId}`)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
    >
      {/* Thumbnail */}
      <div className="relative shrink-0">
        {video.cover_url ? (
          <img
            src={video.cover_url}
            alt={video.title}
            referrerPolicy="no-referrer"
            className="h-[62px] w-[100px] rounded object-cover"
          />
        ) : (
          <div className="flex h-[62px] w-[100px] items-center justify-center rounded bg-muted text-xs text-muted-foreground">
            No cover
          </div>
        )}
        {video.duration > 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-mono text-white">
            {formatDuration(video.duration)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="truncate font-semibold text-sm text-foreground">{video.title}</p>
        <p className="text-xs text-muted-foreground">
          {t("video.viewsLabel")}: {formatNumber(video.stats.views)} ·{" "}
          {t("video.likesLabel")}: {formatNumber(video.stats.likes)} ·{" "}
          {t("video.coinsLabel")}: {formatNumber(video.stats.coins)} ·{" "}
          {t("video.favsLabel")}: {formatNumber(video.stats.favorites)} ·{" "}
          {t("stats.danmaku")}: {formatNumber(video.stats.danmaku_count)}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag.trim()}
            </span>
          ))}
          {video.published_at && (
            <span className="text-[10px] text-muted-foreground">
              · {video.published_at.slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function VideoList({ queryId }: VideoListProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<PaginatedVideos | null>(null);
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("views");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 10;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const requestKey = `${queryId}:${sortBy}:${order}:${page}:${search}`;

  useEffect(() => {
    let active = true;
    api
      .getVideos(queryId, {
        sort_by: sortBy,
        order,
        page: String(page),
        page_size: String(pageSize),
        search,
      })
      .then((d) => {
        if (!active) return;
        setResult(d);
        setResolvedRequestKey(requestKey);
      })
      .catch(() => {
        if (!active) return;
        setResult(null);
        setResolvedRequestKey(requestKey);
      });
    return () => { active = false; };
  }, [page, pageSize, queryId, requestKey, search, sortBy, order]);

  const sortOptions: { value: SortField; label: string }[] = [
    { value: "views", label: t("stats.totalViews") },
    { value: "likes", label: t("stats.likes") },
    { value: "coins", label: t("stats.coins") },
    { value: "favorites", label: t("stats.favorites") },
    { value: "shares", label: t("stats.shares") },
    { value: "danmaku", label: t("stats.danmaku") },
    { value: "comments", label: t("stats.comments") },
    { value: "published_at", label: t("video.publishedAt") },
    { value: "duration", label: t("video.duration") },
  ];

  function handleSortChange(val: string | null) {
    if (val) {
      setSortBy(val as SortField);
      setPage(1);
    }
  }

  function toggleOrder() {
    setOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  const totalPages = result?.total_pages ?? 1;
  const videos: VideoSummary[] = result?.items ?? [];
  const loading = requestKey !== resolvedRequestKey;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-foreground">{t("video.list")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-56">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("video.searchPlaceholder")}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger size="sm" className="w-36">
                <SelectValue>
                  {sortOptions.find(opt => opt.value === sortBy)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon-sm" onClick={toggleOrder} aria-label={t("video.toggleOrder")}>              {order === "desc" ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronUpIcon className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Video rows */}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {videos.map((v) => (
            <VideoRow key={v.bvid} video={v} queryId={queryId} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {result && result.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            {t("video.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("video.pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            {t("video.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
