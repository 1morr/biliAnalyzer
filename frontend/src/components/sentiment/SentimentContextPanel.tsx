import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Marginalia from "@/components/proof/Marginalia";
import { Inking, NoInk } from "@/components/proof/States";
import { circleWord } from "@/lib/highlight";
import { cn } from "@/lib/utils";
import { SEP, formatExact } from "@/lib/format";
import type { SentimentContextResponse } from "@/types";

const LABEL_TONE: Record<string, string> = {
  positive: "text-pos",
  neutral: "text-ink-3",
  negative: "text-neg",
};

/** Mounted only while the margin is open, so its fetch runs once on mount. */
function ContextBody({
  highlightWord,
  fetchContexts,
  onCount,
}: {
  highlightWord?: string;
  fetchContexts: () => Promise<SentimentContextResponse>;
  onCount: (count: number | null) => void;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<SentimentContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchContexts()
      .then((d) => {
        if (!active) return;
        setData(d);
        onCount(d.total_count);
      })
      .catch(() => {
        if (active) setError(t("common.error"));
      });
    return () => {
      active = false;
    };
  }, [fetchContexts, t, onCount]);

  if (error) return <p className="py-6 text-center text-note text-mark">{error}</p>;
  if (!data) return <Inking />;
  if (data.items.length === 0) return <NoInk />;

  return (
    <ul className="border-t border-rule-strong">
      {data.items.map((item, i) => (
        <li key={i} className="border-b border-rule py-2.5">
          <p className="text-body leading-[1.75] text-ink">
            {highlightWord ? circleWord(item.text, highlightWord) : item.text}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-colophon text-ink-3">
            {item.user && <span>@{item.user}</span>}
            {item.source && (
              <span className="tracking-[0.1em] uppercase">
                {t(`chart.wordcloud.source.${item.source}`)}
              </span>
            )}
            <span className={cn("tabular-nums", LABEL_TONE[item.label] ?? "text-ink-3")}>
              {t(`sentiment.${item.label}`)} {(item.score * 100).toFixed(0)}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** 情感旁批：分數背後的那幾句原話。 */
export default function SentimentContextPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  highlightWord,
  fetchContexts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  highlightWord?: string;
  fetchContexts: () => Promise<SentimentContextResponse>;
}) {
  const { i18n } = useTranslation();
  const [count, setCount] = useState<number | null>(null);

  const meta =
    [subtitle, count !== null ? formatExact(count, i18n.language) : null]
      .filter(Boolean)
      .join(SEP) || undefined;

  return (
    <Marginalia
      open={open}
      onOpenChange={(next) => {
        if (!next) setCount(null);
        onOpenChange(next);
      }}
      subject={title}
      meta={meta}
    >
      {open && (
        <ContextBody
          key={title}
          highlightWord={highlightWord}
          fetchContexts={fetchContexts}
          onCount={setCount}
        />
      )}
    </Marginalia>
  );
}
