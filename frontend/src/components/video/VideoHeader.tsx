import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { VideoDetail } from "@/types";

interface VideoHeaderProps {
  video: VideoDetail;
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

export default function VideoHeader({ video }: VideoHeaderProps) {
  const { t } = useTranslation();
  const tags = video.tags ? video.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const bilibiliUrl = `https://www.bilibili.com/video/${video.bvid}`;

  return (
    <div className="flex gap-4 items-start">
      {/* Cover image */}
      <div className="relative flex-shrink-0">
        {video.cover_url ? (
          <img
            src={video.cover_url}
            alt={video.title}
            className="w-[200px] h-[125px] rounded-lg object-cover border border-border"
          />
        ) : (
          <div className="w-[200px] h-[125px] rounded-lg bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground">
            {t("common.noData")}
          </div>
        )}
        {/* Duration badge */}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-mono text-white">
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <h1 className="text-xl font-bold leading-snug line-clamp-2">{video.title}</h1>

        {video.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {video.published_at && (
            <span>
              {t("video.publishedAt")}: {new Date(video.published_at).toLocaleDateString()}
            </span>
          )}
          <span>BV: {video.bvid}</span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div>
          <a
            href={bilibiliUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("video.openOnBilibili")} ↗
          </a>
        </div>
      </div>
    </div>
  );
}
