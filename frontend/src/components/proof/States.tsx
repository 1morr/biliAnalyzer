import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { InsertMark } from "@/components/proof/marks";
import Masthead from "@/components/proof/Masthead";

export type StageState = "done" | "running" | "waiting" | "error" | "skipped";

/** 鉛條：一格填滿的方塊就是一道完成的工序。 */
function StageSlug({ state }: { state: StageState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-[0.3em] size-2.5 shrink-0 border",
        state === "done" && "border-ink bg-ink",
        state === "running" && "animate-pulse border-pencil bg-pencil",
        state === "waiting" && "border-rule-2 bg-transparent",
        state === "error" && "border-mark bg-mark",
        state === "skipped" && "border-rule-2 bg-rule",
      )}
    />
  );
}

export interface Stage {
  key: string;
  label: string;
  state: StageState;
  detail?: string | null;
}

/**
 * 付印工序 —— waiting is a designed state here, not a spinner. Each stage is a
 * real backend phase; none of them are invented to pad the list.
 */
export function PressRun({ stages, className }: { stages: Stage[]; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("w-full max-w-md", className)}>
      <p className="column-label border-b border-rule-strong pb-2">{t("press.title")}</p>
      <ol className="mt-0">
        {stages.map((s, i) => (
          <li key={s.key} className="flex gap-3 border-b border-rule py-2.5">
            <span className="mt-[0.15em] w-4 shrink-0 text-note tabular-nums text-ink-3">
              {i + 1}
            </span>
            <StageSlug state={s.state} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-ui leading-snug",
                  s.state === "waiting" ? "text-ink-3" : "text-ink",
                  s.state === "error" && "text-mark",
                )}
              >
                {s.label}
              </p>
              {s.detail && (
                <p className="mt-0.5 text-note leading-relaxed text-pencil">{s.detail}</p>
              )}
            </div>
            <span className="mt-[0.15em] shrink-0 text-note text-ink-3">
              {t(`press.state.${s.state}`)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 缺欄 —— a gap the sheet cannot fill yet, ringed in blue pencil with a note
 * saying what it needs. Used for SESSDATA and AI configuration.
 */
export function MissingColumn({
  title,
  note,
  actionLabel,
  actionTo,
  className,
}: {
  title: string;
  note: string;
  actionLabel?: string;
  actionTo?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border border-dashed border-pencil bg-pencil-wash px-4 py-3",
        className,
      )}
    >
      <InsertMark className="mt-0.5 size-4 shrink-0 text-pencil" />
      <div className="min-w-0 flex-1">
        <p className="text-ui font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-note leading-relaxed text-ink-2">{note}</p>
        {actionLabel && actionTo && (
          <Link
            to={actionTo}
            className="mt-1.5 inline-block text-note text-pencil underline underline-offset-[0.22em] decoration-pencil/50 hover:decoration-pencil"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * 空白樣張：還沒有稿件的版面。The masthead carries the state's OWN subject —
 * the wordmark is already on the 檢字架, and 一號 belongs to what this sheet is
 * about. The 花邊 runs the full measure, so an empty sheet is still this
 * publication, at an earlier hour.
 */
export function BlankSheet({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action?: React.ReactNode;
}) {
  return (
    <>
      <Masthead title={title} />
      <div className="flex flex-col px-4 pt-6 pb-16 md:px-8">
        <div className="rule-double pt-5">
          <p className="prose-cn max-w-[46ch] text-body leading-[1.9] text-ink-2">{note}</p>
          {action && <div className="mt-5">{action}</div>}
        </div>
      </div>
    </>
  );
}

/** 上墨：一格墨在呼吸。取代 spinner —— 動作語彙是墨的出現，不是東西在轉。 */
export function InkPulse({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-2.5 shrink-0 animate-pulse bg-current", className)} />;
}

/** 上墨中：內容還在顯影，而不是骨架屏在閃。 */
export function Inking({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cn("animate-pulse py-6 text-center text-note text-ink-3", className)}>
      {label ?? t("common.loading")}
    </p>
  );
}

/** 版面缺料：這一欄沒有可排的內容。 */
export function NoInk({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cn("py-6 text-center text-note text-ink-3", className)}>
      {label ?? t("common.noData")}
    </p>
  );
}
