import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { QuerySummary } from "@/types";
import NewQueryDialog from "@/components/dashboard/NewQueryDialog";

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { queryId } = useParams<{ queryId?: string }>();

  const [queries, setQueries] = useState<QuerySummary[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Poll queries every 3 seconds to update status during fetching
  useEffect(() => {
    let active = true;

    async function fetchQueries() {
      try {
        const data = await api.getQueries();
        if (active) setQueries(data);
      } catch {
        // ignore errors silently
      }
    }

    fetchQueries();
    const id = setInterval(fetchQueries, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  function toggleLanguage() {
    const next = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  }

  function formatViews(views: number): string {
    if (views >= 10000) return `${(views / 10000).toFixed(1)}w`;
    return String(views);
  }

  return (
    <>
      <aside className="flex h-full w-[220px] shrink-0 flex-col bg-slate-50 dark:bg-slate-900 border-r border-border">
        {/* Header */}
        <div className="flex h-12 items-center px-4 shrink-0">
          <span
            className="text-[15px] font-bold text-foreground select-none"
            style={{ fontSize: "15px" }}
          >
            {t("app.title")}
          </span>
        </div>

        {/* New Query button */}
        <div className="px-3 pb-3 shrink-0">
          <Button
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 text-white border-0 text-sm font-medium"
            onClick={() => setDialogOpen(true)}
          >
            {t("app.newQuery")}
          </Button>
        </div>

        {/* Query History section */}
        <div className="flex flex-col flex-1 min-h-0 px-3">
          <p
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0"
            style={{ fontSize: "10px" }}
          >
            {t("sidebar.queryHistory")}
          </p>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1.5 pb-2">
              {queries.length === 0 && (
                <p className="text-[11px] text-muted-foreground py-2 text-center">
                  {t("common.noData")}
                </p>
              )}
              {queries.map((q) => {
                const isActive = queryId === String(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigate(`/dashboard/${q.id}`)}
                    className={cn(
                      "w-full rounded-lg border p-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
                      isActive
                        ? "border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border border-border"
                    )}
                  >
                    <p
                      className="font-semibold text-foreground truncate"
                      style={{ fontSize: "12px" }}
                    >
                      UID: {q.uid}
                    </p>
                    <p
                      className="text-muted-foreground truncate"
                      style={{ fontSize: "10px" }}
                    >
                      {q.start_date} → {q.end_date}
                    </p>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: "10px" }}
                    >
                      {q.video_count} {t("sidebar.videos")} ·{" "}
                      {formatViews(q.total_views)} {t("sidebar.views")}
                    </p>
                    {q.status !== "done" && (
                      <p
                        className={cn(
                          "mt-0.5 text-[10px] font-medium",
                          q.status === "fetching"
                            ? "text-blue-500"
                            : q.status === "error"
                              ? "text-red-500"
                              : "text-muted-foreground"
                        )}
                        style={{ fontSize: "10px" }}
                      >
                        {q.status === "fetching"
                          ? q.progress ?? t("common.loading")
                          : q.status}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Footer: settings + language toggle */}
        <div className="flex items-center justify-between px-3 py-2 shrink-0 border-t border-border">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
          >
            <SettingsIcon className="size-4" />
          </Button>

          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {i18n.language === "zh" ? "EN" : "中"}
          </button>
        </div>
      </aside>

      {/* New Query Dialog */}
      <NewQueryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onFetchStarted={() => {
          // Queries will refresh via polling
        }}
      />
    </>
  );
}
