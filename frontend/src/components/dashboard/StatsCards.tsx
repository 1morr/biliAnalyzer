import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import type { StatsSummary } from "@/types";

interface StatsCardsProps {
  data: StatsSummary;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface CardDef {
  labelKey: string;
  value: number;
  color: string;
}

export default function StatsCards({ data }: StatsCardsProps) {
  const { t } = useTranslation();

  const cards: CardDef[] = [
    { labelKey: "stats.totalViews", value: data.total_views, color: "text-blue-500" },
    { labelKey: "stats.likes", value: data.total_likes, color: "text-red-500" },
    { labelKey: "stats.coins", value: data.total_coins, color: "text-amber-500" },
    { labelKey: "stats.favorites", value: data.total_favorites, color: "text-purple-500" },
    { labelKey: "stats.shares", value: data.total_shares, color: "text-cyan-500" },
    { labelKey: "stats.danmaku", value: data.total_danmaku, color: "text-orange-500" },
    { labelKey: "stats.comments", value: data.total_comments, color: "text-pink-500" },
    { labelKey: "stats.videos", value: data.video_count, color: "text-green-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.labelKey} size="sm">
          <CardContent className="flex flex-col gap-1 py-3">
            <span className="text-xs text-muted-foreground">{t(card.labelKey)}</span>
            <span className={`text-2xl font-bold leading-tight ${card.color}`}>
              {formatNumber(card.value)}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
