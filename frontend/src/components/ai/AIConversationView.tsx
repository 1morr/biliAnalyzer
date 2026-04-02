import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UserIcon, SparklesIcon, WrenchIcon, ChevronDownIcon } from "lucide-react";
import type { AIMessageItem, ToolCallInfo } from "@/types";

interface AIConversationViewProps {
  messages: AIMessageItem[];
  streamingContent: string;
  activeTools: ToolCallInfo[];
  usedTools: ToolCallInfo[];
  isStreaming: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const markdownClasses =
  "leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:text-left [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6";

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
}

function formatResult(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function ToolBadge({ tool }: { tool: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  const hasArgs = Object.keys(tool.arguments).length > 0;
  const hasDetail = hasArgs || tool.result;

  return (
    <span className="inline-flex flex-col rounded-md bg-muted text-xs text-muted-foreground overflow-hidden">
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 ${hasDetail ? "cursor-pointer hover:bg-muted/80" : "cursor-default"}`}
      >
        <WrenchIcon className="size-3 shrink-0" />
        <span>{tool.name}</span>
        {hasDetail && (
          <ChevronDownIcon className={`size-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && hasDetail && (
        <div className="border-t border-border/50 font-mono text-[10px]">
          {hasArgs && (
            <div className="px-2 py-1 break-all">
              <span className="text-muted-foreground/70">args: </span>
              {formatArgs(tool.arguments)}
            </div>
          )}
          {tool.result && (
            <pre className="px-2 py-1 border-t border-border/30 max-h-40 overflow-auto whitespace-pre-wrap break-all">
              {formatResult(tool.result)}
            </pre>
          )}
        </div>
      )}
    </span>
  );
}

function ToolBadgeList({ tools }: { tools: ToolCallInfo[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {tools.map((tool, i) => <ToolBadge key={i} tool={tool} />)}
    </div>
  );
}

export default function AIConversationView({
  messages, streamingContent, activeTools, usedTools, isStreaming, scrollContainerRef,
}: AIConversationViewProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  // Only disengage auto-scroll on explicit upward scroll (user pulling up).
  // Downward movement from smooth-scroll animation or content growth won't disengage.
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;
    const threshold = 80;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    const scrolledUp = el.scrollTop < lastScrollTopRef.current - 2;
    lastScrollTopRef.current = el.scrollTop;

    if (nearBottom) {
      isNearBottomRef.current = true;
    } else if (scrolledUp) {
      isNearBottomRef.current = false;
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef, handleScroll]);

  // Only auto-scroll when user is near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, activeTools, usedTools]);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-2">
          <div className="mt-0.5 shrink-0">
            {msg.role === "user" ? (
              <UserIcon className="size-4 text-muted-foreground" />
            ) : (
              <SparklesIcon className="size-4 text-purple-500" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            {/* Show tool calls badge for assistant messages that used tools */}
            {msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0 && (
              <ToolBadgeList tools={msg.tool_calls} />
            )}
            {msg.role === "assistant" ? (
              <div className={markdownClasses}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                  {msg.content || ""}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-foreground">{msg.content}</p>
            )}
          </div>
        </div>
      ))}

      {/* Streaming response block */}
      {(streamingContent || isStreaming || usedTools.length > 0) && (
        <div className="flex gap-2">
          <SparklesIcon className="mt-0.5 size-4 shrink-0 text-purple-500" />
          <div className="min-w-0 flex-1 text-sm">
            {/* Tool badges — persistent record of all tools called */}
            {usedTools.length > 0 && (
              <ToolBadgeList tools={usedTools} />
            )}
            {streamingContent ? (
              <div className={markdownClasses}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                  {streamingContent}
                </ReactMarkdown>
              </div>
            ) : isStreaming ? (
              <p className="text-muted-foreground animate-pulse">{t("ai.analyzing")}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Live tool activity indicator */}
      {activeTools.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse pl-6">
          <WrenchIcon className="size-3" />
          {t("ai.toolQuerying")}: {activeTools.map((t) => t.name).join(", ")}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
