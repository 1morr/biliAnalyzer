import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SparklesIcon, RefreshCwIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface AIPanelProps {
  queryId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AIPanel({ queryId, open, onOpenChange }: AIPanelProps) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function startAnalysis() {
    // Cancel any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText("");
    setError(null);
    setStreaming(true);

    try {
      const url = api.aiAnalyzeUrl(queryId);
      const resp = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Accept-Language": i18n.language,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const msg = await resp.text().catch(() => `HTTP ${resp.status}`);
        setError(msg || `HTTP ${resp.status}`);
        setStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const data = JSON.parse(raw);
              if (data.content) {
                setText((prev) => prev + data.content);
              }
              if (data.event === "done" || data.done) {
                setStreaming(false);
              }
              if (data.event === "error" || data.error) {
                setError(data.error || t("common.error"));
                setStreaming(false);
              }
            } catch {
              // Non-JSON line — treat as raw content
              setText((prev) => prev + raw);
            }
          } else if (line.startsWith("event: done")) {
            setStreaming(false);
          } else if (line.startsWith("event: error")) {
            setError(t("common.error"));
            setStreaming(false);
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setError((err as Error)?.message || t("common.error"));
      }
    } finally {
      setStreaming(false);
    }
  }

  // Start analysis when panel opens
  useEffect(() => {
    if (open) {
      startAnalysis();
    } else {
      abortRef.current?.abort();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queryId]);

  // Auto-scroll to bottom as text streams in
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-[420px] sm:max-w-[420px] p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 pr-8">
            <SparklesIcon className="size-5 text-purple-500" />
            <SheetTitle className="text-base">{t("ai.title")}</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Query #{queryId}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-4 py-3 text-sm text-foreground"
        >
          {error ? (
            <p className="text-red-500">{error}</p>
          ) : streaming && !text ? (
            <p className="text-muted-foreground animate-pulse">{t("ai.analyzing")}</p>
          ) : text ? (
            <div className="leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:text-left [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {text}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground">{t("ai.analyzing")}</p>
          )}
        </div>

        <SheetFooter className="border-t border-border px-4 py-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={startAnalysis}
            disabled={streaming}
            className="gap-1.5"
          >
            <RefreshCwIcon className={`size-3.5 ${streaming ? "animate-spin" : ""}`} />
            {t("ai.regenerate")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
