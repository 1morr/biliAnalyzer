import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Marginalia from "@/components/proof/Marginalia";
import { Inking, NoInk } from "@/components/proof/States";
import { GAP, SEP, formatExact } from "@/lib/format";
import { circleWord } from "@/lib/highlight";
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

/**
 * The note's body mounts only while the margin is open and remounts per word,
 * so its fetch runs once on mount rather than resetting state inside an effect.
 */
function NoteBody({
  word,
  fetchDetail,
  showVideoBreakdown,
  countLabelMode,
  onMeta,
}: {
  word: string;
  fetchDetail: (word: string) => Promise<WordDetailResponse>;
  showVideoBreakdown: boolean;
  countLabelMode: CountLabelMode;
  onMeta: (meta: string | undefined) => void;
}) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<WordDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDetail(word)
      .then((d) => {
        if (!active) return;
        setData(d);
        const countKey =
          countLabelMode === "uniqueUsers"
            ? "chart.wordcloud.uniqueUsers"
            : "chart.wordcloud.occurrences";
        onMeta(
          [
            t(countKey, { count: d.total_count }),
            showVideoBreakdown && d.videos.length > 0
              ? t("chart.wordcloud.inVideos", { count: d.videos.length })
              : null,
          ]
            .filter(Boolean)
            .join(SEP),
        );
      })
      .catch(() => {
        if (active) setError(t("common.error"));
      });
    return () => {
      active = false;
    };
  }, [word, fetchDetail, t, countLabelMode, showVideoBreakdown, onMeta]);

  if (error) return <p className="py-6 text-center text-note text-mark">{error}</p>;
  if (!data) return <Inking />;

  return (
    <div className="flex flex-col gap-6">
      {showVideoBreakdown && data.videos.length > 1 && (
        <section>
          <h4 className="column-label border-b border-rule-strong pb-1.5">
            {t("chart.wordcloud.perVideo")}
          </h4>
          <ul>
            {data.videos.map((v) => (
              <li
                key={v.bvid}
                className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5"
              >
                <Link
                  to={`/video/${v.bvid}`}
                  className="min-w-0 flex-1 truncate text-note text-ink"
                  title={v.title}
                >
                  {v.title}
                </Link>
                <span className="shrink-0 text-note tabular-nums text-ink-3">{v.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.videos.some((v) => v.snippets.length > 0) && (
        <section>
          <h4 className="column-label border-b border-rule-strong pb-1.5">
            {t("chart.wordcloud.contexts")}
          </h4>
          <ul>
            {data.videos.flatMap((v) =>
              v.snippets.map((snippet: SnippetItem, i: number) => (
                <li key={`${v.bvid}-${i}`} className="border-b border-rule py-2.5">
                  <p className="text-body leading-[1.75] text-ink">
                    {circleWord(snippet.text, word)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-colophon text-ink-3">
                    {snippet.user && <span>@{snippet.user}</span>}
                    {snippet.source && (
                      <span className="tracking-[0.1em] uppercase">
                        {t(`chart.wordcloud.source.${snippet.source}`)}
                      </span>
                    )}
                    {showVideoBreakdown && data.videos.length > 1 && (
                      <span className="min-w-0 truncate">{v.title}</span>
                    )}
                  </p>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {data.total_count === 0 && <NoInk />}

      <p className="colophon">
        {t("chart.wordcloud.frequency")}
        {GAP}
        {formatExact(data.total_count, i18n.language)}
      </p>
    </div>
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
  const [meta, setMeta] = useState<string | undefined>();

  return (
    <Marginalia
      open={open}
      onOpenChange={(next) => {
        if (!next) setMeta(undefined);
        onOpenChange(next);
      }}
      subject={word || t("chart.wordcloud.detail")}
      meta={meta}
    >
      {open && word && (
        <NoteBody
          key={word}
          word={word}
          fetchDetail={fetchDetail}
          showVideoBreakdown={showVideoBreakdown}
          countLabelMode={countLabelMode}
          onMeta={setMeta}
        />
      )}
    </Marginalia>
  );
}
