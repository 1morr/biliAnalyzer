import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquareTextIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { SentimentContextResponse } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  highlightWord?: string;
  fetchContexts: () => Promise<SentimentContextResponse>;
}

const LABEL_COLORS: Record<string, string> = {
  positive: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  neutral: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  negative: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

function highlightText(text: string, word?: string) {
  if (!word) return <span>{text}</span>;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "g"));
  return parts.map((part, i) =>
    part === word ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function SentimentContextPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  highlightWord,
  fetchContexts,
}: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<SentimentContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetchContexts()
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.message || t("common.error")); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [open, fetchContexts, t]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-[400px] sm:max-w-[400px] p-0"
        showCloseButton={true}
      >
        <SheetHeader className="border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 pr-8">
            <MessageSquareTextIcon className="size-5 text-blue-500" />
            <SheetTitle className="text-base">{title}</SheetTitle>
          </div>
          {(subtitle || data) && (
            <SheetDescription className="text-xs">
              {subtitle}
              {data && <>{subtitle ? " · " : ""}{t("sentiment.contextCount", { count: data.total_count })}</>}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {loading ? (
            <p className="text-muted-foreground animate-pulse">{t("common.loading")}</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : data && data.items.length > 0 ? (
            <ul className="space-y-2">
              {data.items.map((item, i) => (
                <li
                  key={i}
                  className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground"
                >
                  {highlightText(item.text, highlightWord)}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${LABEL_COLORS[item.label] || LABEL_COLORS.neutral}`}>
                      {t(`sentiment.${item.label}`)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("sentiment.score")}: {(item.score * 100).toFixed(1)}
                    </span>
                    {item.user && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                        @{item.user}
                      </span>
                    )}
                    {item.source && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                        {t(`chart.wordcloud.source.${item.source}`)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : data ? (
            <p className="text-muted-foreground text-xs">{t("common.noData")}</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
