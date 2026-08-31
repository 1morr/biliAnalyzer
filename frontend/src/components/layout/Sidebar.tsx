import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SettingsIcon, SunIcon, MoonIcon, LaptopIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";
import { CircleMark, DeleteMark } from "@/components/proof/marks";
import type { QuerySummary } from "@/types";
import NewQueryDialog from "@/components/dashboard/NewQueryDialog";

interface SidebarProps {
  onNavigate?: () => void;
}

const THEME_ORDER = ["light", "dark", "system"] as const;

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { queryId } = useParams<{ queryId?: string }>();
  const { theme, setTheme } = useTheme();

  const [queries, setQueries] = useState<QuerySummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuerySummary | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchQueries() {
      try {
        const data = await api.getQueries();
        if (active) setQueries(data);
      } catch {
        // The index keeps its last good state; the sheet says nothing it cannot prove.
      } finally {
        if (active) setLoaded(true);
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
    const next = i18n.language.startsWith("zh") ? "en" : "zh";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  }

  function cycleTheme() {
    const i = THEME_ORDER.indexOf(theme as (typeof THEME_ORDER)[number]);
    setTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
  }

  function go(to: string) {
    navigate(to);
    onNavigate?.();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    try {
      await api.deleteQuery(deletedId);
      setQueries((prev) => prev.filter((q) => q.id !== deletedId));
      if (queryId === String(deletedId)) navigate("/dashboard");
    } catch {
      // Deletion failed; the next poll restores the true list.
    } finally {
      setDeleteTarget(null);
    }
  }

  const ThemeIcon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : LaptopIcon;

  return (
    <>
      <aside className="flex h-full flex-col bg-paper-2">
        {/* 刊頭 —— 與報頭同高（--head-h），兩條頭線接成橫貫整張紙的一條。 */}
        <div className="flex h-[var(--head-h)] shrink-0 flex-col justify-center border-b-2 border-rule-strong px-4">
          <p className="font-song text-h3 leading-none font-semibold tracking-tight text-ink">
            {t("app.title")}
          </p>
          <p className="colophon mt-1.5">{t("app.tagline")}</p>
        </div>

        <div className="px-4 py-3">
          <Button variant="default" size="lg" className="w-full" onClick={() => setDialogOpen(true)}>
            {t("app.newQuery")}
          </Button>
        </div>

        {/* 稿件目錄 */}
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="column-label px-4 pb-1.5">{t("sidebar.queryHistory")}</p>

          <ScrollArea className="min-h-0 flex-1">
            <ul className="border-t border-rule">
              {loaded && queries.length === 0 && (
                <li className="px-4 py-4 text-note leading-relaxed text-ink-3">
                  {t("sidebar.emptyIndex")}
                </li>
              )}
              {queries.map((q) => {
                const isActive = queryId === String(q.id);
                const busy = q.status === "fetching" || q.status === "fetching_content";
                return (
                  <li
                    key={q.id}
                    className={cn(
                      "group relative border-b border-rule transition-colors",
                      isActive ? "bg-paper" : "hover:bg-paper-2",
                    )}
                  >
                    {isActive && (
                      <CircleMark className="pointer-events-none absolute top-3 left-1.5 size-3.5 text-mark" />
                    )}
                    <button
                      type="button"
                      onClick={() => go(`/dashboard/${q.id}`)}
                      className="w-full py-2.5 pr-8 pl-6 text-left outline-none focus-visible:bg-paper-2"
                      aria-current={isActive ? "true" : undefined}
                    >
                      <p
                        className={cn(
                          "truncate font-song text-ui leading-snug font-semibold",
                          isActive ? "text-mark" : "text-ink",
                        )}
                      >
                        {q.user_name || `UID ${q.uid}`}
                      </p>
                      <p className="mt-0.5 truncate text-note tabular-nums text-ink-3">
                        {q.start_date} — {q.end_date}
                      </p>
                      <p className="text-note tabular-nums text-ink-3">
                        {t("sidebar.summary", {
                          videos: q.video_count,
                          views: formatCount(q.total_views, i18n.language),
                        })}
                      </p>
                      {q.status !== "done" && (
                        <p
                          className={cn(
                            "mt-1 truncate text-note",
                            busy ? "text-pencil" : "text-mark",
                          )}
                        >
                          {busy
                            ? (q.progress ?? t("press.running"))
                            : t(`press.status.${q.status}`, { defaultValue: q.status })}
                        </p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(q);
                      }}
                      className="absolute top-2.5 right-2 p-1 text-ink-3 opacity-0 transition-opacity hover:text-mark focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={t("sidebar.deleteQuery")}
                    >
                      <DeleteMark className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>

        {/* 版邊控制 */}
        <div className="flex items-center gap-1 border-t border-rule-strong px-3 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => go("/settings")}
            aria-label={t("settings.title")}
          >
            <SettingsIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={cycleTheme}
            aria-label={t(`theme.${theme}`)}
            title={t(`theme.${theme}`)}
          >
            <ThemeIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto tracking-[0.14em]"
            onClick={toggleLanguage}
          >
            {i18n.language.startsWith("zh") ? "EN" : "中"}
          </Button>
        </div>
      </aside>

      <NewQueryDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sidebar.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("sidebar.deleteConfirmDesc", {
                name: deleteTarget?.user_name || `UID ${deleteTarget?.uid}`,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("sidebar.deleteQuery")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
