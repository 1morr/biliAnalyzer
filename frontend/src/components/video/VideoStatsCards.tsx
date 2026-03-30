import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import type { VideoStats } from "@/types";

interface VideoStatsCardsProps {
  stats: VideoStats;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface CardDef {
  labelKey: string;
  value: string;
  color: string;
}

export default function VideoStatsCards({ stats }: VideoStatsCardsProps) {
  const { t } = useTranslation();

  const cards: CardDef[] = [
    { labelKey: "stats.totalViews", value: formatNumber(stats.views), color: "text-blue-500" },
    { labelKey: "stats.likes", value: formatNumber(stats.likes), color: "text-red-500" },
    { labelKey: "stats.coins", value: formatNumber(stats.coins), color: "text-amber-500" },
    { labelKey: "stats.favorites", value: formatNumber(stats.favorites), color: "text-purple-500" },
    { labelKey: "stats.shares", value: formatNumber(stats.shares), color: "text-cyan-500" },
    { labelKey: "stats.danmaku", value: formatNumber(stats.danmaku_count), color: "text-orange-500" },
    { labelKey: "stats.comments", value: formatNumber(stats.comment_count), color: "text-pink-500" },
    {
      labelKey: "stats.interactionRate",
      value: `${(stats.interaction_rate * 100).toFixed(2)}%`,
      color: "text-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.labelKey} size="sm">
          <CardContent className="flex flex-col gap-1 py-3">
            <span className="text-xs text-muted-foreground">{t(card.labelKey)}</span>
            <span className={`text-2xl font-bold leading-tight ${card.color}`}>
              {card.value}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
