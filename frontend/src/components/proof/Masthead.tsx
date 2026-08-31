import * as React from "react";
import { useTranslation } from "react-i18next";
import { MenuIcon } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export interface MastheadMeta {
  label: string;
  value: React.ReactNode;
}

/**
 * 報頭 —— the sheet's own head, under a heavy rule. Every page starts with one;
 * there is no second global bar above it.
 *
 * The head is exactly --head-h tall on every page, and the 檢字架 head matches
 * it, so the heavy rule reads as ONE line running across the whole sheet. That
 * is why the title row takes no optional stacking: the back link sits beside
 * the title, and the meta prints below the rule as a dateline that scrolls.
 */
export default function Masthead({
  title,
  back,
  meta = [],
  actions,
  className,
}: {
  title: React.ReactNode;
  /** The way back to the sheet this one was opened from. */
  back?: React.ReactNode;
  meta?: MastheadMeta[];
  actions?: React.ReactNode;
  className?: string;
}) {
  const { openIndex } = useAppContext();
  const { t } = useTranslation();

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex min-h-[var(--head-h)] items-center gap-3 border-b-2 border-rule-strong bg-paper px-4 py-2 sm:h-[var(--head-h)] sm:py-0 md:px-8",
          className,
        )}
      >
        <button
          type="button"
          onClick={openIndex}
          className="-ml-1.5 shrink-0 p-1.5 text-ink-2 transition-colors hover:text-mark sm:hidden"
          aria-label={t("app.openIndex")}
        >
          <MenuIcon className="size-5" />
        </button>

        {back && <div className="flex shrink-0 items-center">{back}</div>}

        <h1 className="min-w-0 flex-1 font-song text-h2 leading-[1.15] font-semibold text-ink line-clamp-2 sm:line-clamp-none sm:truncate sm:text-h1">
          {title}
        </h1>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {meta.length > 0 && (
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-rule px-4 py-2 md:px-8">
          {meta.map((m) => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <dt className="column-label">{m.label}</dt>
              <dd className="text-note text-ink-2 tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
