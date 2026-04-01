import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BookOpenIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { WordDetailResponse, SnippetItem } from "@/types";

type CountLabelMode = "occurrences" | "uniqueUsers";

interface WordDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: string | null;
  fetchDetail: (word: string) => Promise<WordDetailResponse>;
  showVideoBreakdown?: boolean;
  countLabelMode?: CountLabelMode;
}

function highlightWord(text: string, word: string) {
  const parts = text.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "g"));
  return parts.map((part, i) =>
    part === word ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function WordDetailPanel({
  open,
  onOpenChange,
  word,
  fetchDetail,
  showVideoBreakdown = true,
  countLabelMode = "occurrences",
}: WordDetailPanelProps) {
  const { t } = useTranslation();
  const countLabelKey = countLabelMode === "uniqueUsers" ? "chart.wordcloud.uniqueUsers" : "chart.wordcloud.occurrences";
  const [data, setData] = useState<WordDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !word) return;
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetchDetail(word)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.message || t("common.error")); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [open, word, fetchDetail, t]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-[400px] sm:max-w-[400px] p-0"
        showCloseButton={true}
      >
        <SheetHeader className="border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 pr-8">
            <BookOpenIcon className="size-5 text-blue-500" />
            <SheetTitle className="text-base">
              {word || t("chart.wordcloud.detail")}
            </SheetTitle>
          </div>
          {data && (
            <SheetDescription className="text-xs">
              {t(countLabelKey, { count: data.total_count })}
              {showVideoBreakdown && data.videos.length > 0 && (
                <> · {t("chart.wordcloud.inVideos", { count: data.videos.length })}</>
              )}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {loading ? (
            <p className="text-muted-foreground animate-pulse">{t("common.loading")}</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : data ? (
            <div className="flex flex-col gap-4">
              {/* Per-video breakdown */}
              {showVideoBreakdown && data.videos.length > 1 && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("chart.wordcloud.perVideo")}
                  </h3>
                  <ul className="space-y-1.5">
                    {data.videos.map((v) => (
                      <li key={v.bvid} className="flex items-center justify-between gap-2">
                        <Link
                          to={`/video/${v.bvid}`}
                          className="text-sm text-foreground hover:text-blue-500 truncate flex-1"
                          title={v.title}
                        >
                          {v.title}
                        </Link>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {v.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Context snippets */}
              {data.videos.some((v) => v.snippets.length > 0) && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("chart.wordcloud.contexts")}
                  </h3>
                  <ul className="space-y-2">
                    {data.videos.flatMap((v) =>
                      v.snippets.map((snippet: SnippetItem, i: number) => (
                        <li
                          key={`${v.bvid}-${i}`}
                          className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground"
                        >
                          {highlightWord(snippet.text, word!)}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {snippet.user && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                @{snippet.user}
                              </span>
                            )}
                            {snippet.source && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                                {t(`chart.wordcloud.source.${snippet.source}`)}
                              </span>
                            )}
                            {showVideoBreakdown && data.videos.length > 1 && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                — {v.title}
                              </span>
                            )}
                          </div>
                        </li>
                      )),
                    )}
                  </ul>
                </section>
              )}

              {data.total_count === 0 && (
                <p className="text-muted-foreground text-xs">{t("common.noData")}</p>
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
