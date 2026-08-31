import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIMessageItem, ToolCallInfo } from "@/types";

interface AIConversationViewProps {
  messages: AIMessageItem[];
  streamingContent: string;
  usedTools: ToolCallInfo[];
  isStreaming: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

/** 批註的正文：宋體標題、無圓角、欄線分隔的表格。 */
const markdownClasses = [
  "text-body leading-[1.8] text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_a]:text-mark [&_a]:underline [&_a]:decoration-mark/40 [&_a:hover]:decoration-mark",
  "[&_blockquote]:my-4 [&_blockquote]:border-l [&_blockquote]:border-rule-2 [&_blockquote]:pl-4 [&_blockquote]:text-ink-2",
  "[&_code]:bg-paper-2 [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.88em]",
  "[&_h1]:mt-6 [&_h1]:mb-2.5 [&_h1]:font-song [&_h1]:text-h3 [&_h1]:font-semibold",
  "[&_h2]:mt-5 [&_h2]:mb-2.5 [&_h2]:font-song [&_h2]:text-h4 [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-song [&_h3]:text-body [&_h3]:font-semibold",
  "[&_hr]:my-5 [&_hr]:border-rule",
  "[&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_p]:my-3",
  "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-rule [&_pre]:bg-paper-2 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
  "[&_td]:border [&_td]:border-rule [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:tabular-nums",
  "[&_th]:border [&_th]:border-rule [&_th]:bg-paper-2 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:font-medium",
].join(" ");

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
}

function formatResult(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** 查證記錄：AI 去查了哪張表。藍鉛筆 —— 這是系統的話，不是批註。 */
function ToolNote({ tool }: { tool: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  const hasArgs = Object.keys(tool.arguments).length > 0;
  const hasDetail = hasArgs || Boolean(tool.result);

  return (
    <span className="inline-flex max-w-full flex-col border border-pencil/40 bg-pencil-wash">
      <button
        type="button"
        onClick={() => hasDetail && setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-colophon tracking-normal text-pencil",
          hasDetail ? "cursor-pointer hover:bg-pencil/10" : "cursor-default",
        )}
      >
        <span>{tool.name}</span>
        {hasDetail && (
          <ChevronDownIcon className={cn("size-3 shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>
      {open && hasDetail && (
        <span className="block border-t border-pencil/30 text-colophon tracking-normal">
          {hasArgs && <span className="block px-1.5 py-1 break-all text-ink-2">{formatArgs(tool.arguments)}</span>}
          {tool.result && (
            <pre className="max-h-40 overflow-auto border-t border-pencil/20 px-1.5 py-1 break-all whitespace-pre-wrap text-ink-2">
              {formatResult(tool.result)}
            </pre>
          )}
        </span>
      )}
    </span>
  );
}

function ToolNotes({ tools }: { tools: ToolCallInfo[] }) {
  if (!tools.length) return null;
  return (
    <div className="mb-2 flex flex-wrap items-start gap-1.5">
      {tools.map((tool, i) => (
        <ToolNote key={i} tool={tool} />
      ))}
    </div>
  );
}

/** 一則往返：左欄是署名，右欄是內容，中間一條欄線。 */
function Exchange({ mark, children }: { mark: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr] gap-x-3 border-b border-rule py-3 last:border-b-0">
      <span
        className={cn(
          "border-r border-rule pr-3 text-right font-song text-note leading-6",
          mark === "批" ? "text-mark" : "text-ink-3",
        )}
      >
        {mark}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function AIConversationView({
  messages,
  streamingContent,
  usedTools,
  isStreaming,
  scrollContainerRef,
}: AIConversationViewProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const scrolledUp = el.scrollTop < lastScrollTopRef.current - 2;
    lastScrollTopRef.current = el.scrollTop;
    if (nearBottom) isNearBottomRef.current = true;
    else if (scrolledUp) isNearBottomRef.current = false;
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef, handleScroll]);

  useEffect(() => {
    if (isNearBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, usedTools]);

  return (
    <div className="flex flex-col px-4 py-1">
      {messages.map((msg) => (
        <Exchange key={msg.id} mark={msg.role === "user" ? t("ai.markAsk") : t("ai.markNote")}>
          {msg.role === "assistant" ? (
            <>
              {msg.tool_calls && msg.tool_calls.length > 0 && <ToolNotes tools={msg.tool_calls} />}
              <div className={markdownClasses}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                  {msg.content || ""}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <p className="text-body leading-[1.8] text-ink">{msg.content}</p>
          )}
        </Exchange>
      ))}

      {(streamingContent || isStreaming || usedTools.length > 0) && (
        <Exchange mark={t("ai.markNote")}>
          {usedTools.length > 0 && <ToolNotes tools={usedTools} />}
          {streamingContent ? (
            <div className={markdownClasses}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {streamingContent}
              </ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <p className="animate-pulse text-note text-pencil">{t("ai.analyzing")}</p>
          ) : null}
        </Exchange>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
