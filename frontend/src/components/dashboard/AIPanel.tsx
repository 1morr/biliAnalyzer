import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SparklesIcon, ArrowLeftIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AIPreset, AIConversation, AIMessageItem } from "@/types";
import AIPresetSelector from "@/components/ai/AIPresetSelector";
import AIConversationView from "@/components/ai/AIConversationView";
import AIMessageInput from "@/components/ai/AIMessageInput";

interface AIPanelProps {
  queryId?: number;
  bvid?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PanelState = "presets" | "streaming" | "chat" | "error";

const QUERY_PRESETS: AIPreset[] = [
  { id: "overall_analysis", labelKey: "ai.presets.overallAnalysis", descriptionKey: "ai.presets.overallAnalysisDesc", icon: "chart" },
  { id: "topic_inspiration", labelKey: "ai.presets.topicInspiration", descriptionKey: "ai.presets.topicInspirationDesc", icon: "lightbulb" },
];

const VIDEO_PRESETS: AIPreset[] = [
  { id: "video_analysis", labelKey: "ai.presets.videoAnalysis", descriptionKey: "ai.presets.videoAnalysisDesc", icon: "video" },
];

export default function AIPanel({ queryId, bvid, open, onOpenChange }: AIPanelProps) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<PanelState>("presets");
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AIMessageItem[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [usedTools, setUsedTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const presets = bvid ? [...VIDEO_PRESETS, ...QUERY_PRESETS] : QUERY_PRESETS;

  // Load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const convs = bvid
        ? await api.getVideoAIConversations(bvid)
        : queryId ? await api.getAIConversations(queryId) : [];
      setConversations(convs);
    } catch {
      // silently fail
    }
  }, [queryId, bvid]);

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open, loadConversations]);

  // Reset when panel closes
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      // Don't reset state immediately — let the panel animate out
    }
  }, [open]);

  function goBack() {
    abortRef.current?.abort();
    setState("presets");
    setCurrentConvId(null);
    setMessages([]);
    setStreamingContent("");
    setActiveTools([]);
    setUsedTools([]);
    setError(null);
    loadConversations();
  }

  // SSE stream reader
  async function readSSEStream(url: string, body: object) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamingContent("");
    setActiveTools([]);
    setUsedTools([]);
    setError(null);
    setState("streaming");

    let convId: number | null = null;

    try {
      const resp = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Accept-Language": i18n.language,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const msg = await resp.text().catch(() => `HTTP ${resp.status}`);
        setError(msg || `HTTP ${resp.status}`);
        setState("error");
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === "conversation_created") {
              convId = event.conversation_id;
              setCurrentConvId(event.conversation_id);
            } else if (event.type === "user_message") {
              // Show the initial trigger message immediately
              setMessages((prev) => [...prev, {
                id: Date.now(),
                role: "user",
                content: event.content,
                created_at: new Date().toISOString(),
              }]);
            } else if (event.type === "content") {
              accumulated += event.content;
              setStreamingContent(accumulated);
              setActiveTools([]);
            } else if (event.type === "tool_start") {
              setActiveTools((prev) => [...prev, event.name]);
              setUsedTools((prev) => [...prev, event.name]);
            } else if (event.type === "tool_end") {
              // Tool finished — keep it in activeTools until content arrives
            } else if (event.type === "done") {
              // handled after loop
            } else if (event.type === "error") {
              setError(event.error || t("common.error"));
              setState("error");
              return;
            }
          } catch {
            // ignore non-JSON
          }
        }
      }

      // Stream finished — load conversation from DB and transition to chat
      const cid = convId ?? currentConvId;
      if (cid) {
        try {
          const detail = bvid
            ? await api.getVideoAIConversation(bvid, cid)
            : queryId ? await api.getAIConversation(queryId, cid) : null;
          if (detail) {
            setMessages(detail.messages);
            setStreamingContent("");
            setActiveTools([]);
            setUsedTools([]);
            setState("chat");
            return;
          }
        } catch {
          // fall through
        }
      }
      // Fallback: if no detail loaded, still transition to chat
      setStreamingContent("");
      setActiveTools([]);
      setUsedTools([]);
      setState("chat");
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setError((err as Error)?.message || t("common.error"));
        setState("error");
      }
    }
  }

  // Create new conversation
  async function handlePresetSelect(presetId: string) {
    const url = bvid
      ? api.createVideoAIConversationUrl(bvid)
      : queryId ? api.createAIConversationUrl(queryId) : null;
    if (!url) return;

    await readSSEStream(url, { preset: presetId });
  }

  // Resume existing conversation
  async function handleResume(convId: number) {
    setCurrentConvId(convId);
    setState("chat");
    setStreamingContent("");
    setActiveTools([]);
    setUsedTools([]);

    try {
      const detail = bvid
        ? await api.getVideoAIConversation(bvid, convId)
        : queryId ? await api.getAIConversation(queryId, convId) : null;
      if (detail) {
        setMessages(detail.messages);
      }
    } catch {
      setError(t("common.error"));
      setState("error");
    }
  }

  // Delete conversation
  async function handleDelete(convId: number) {
    try {
      if (bvid) {
        await api.deleteVideoAIConversation(bvid, convId);
      } else if (queryId) {
        await api.deleteAIConversation(queryId, convId);
      }
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (currentConvId === convId) {
        goBack();
      }
    } catch {
      // silently fail
    }
  }

  // Send follow-up message
  async function handleSendMessage(content: string) {
    if (!currentConvId) return;

    // Add user message to display immediately
    const tempMsg: AIMessageItem = {
      id: Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const url = bvid
      ? api.sendVideoAIMessageUrl(bvid, currentConvId)
      : queryId ? api.sendAIMessageUrl(queryId, currentConvId) : null;
    if (!url) return;

    await readSSEStream(url, { content });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-[420px] sm:max-w-[420px] p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 pr-8">
            {state !== "presets" && (
              <Button variant="ghost" size="icon" className="size-6" onClick={goBack}>
                <ArrowLeftIcon className="size-4" />
              </Button>
            )}
            <SparklesIcon className="size-5 text-purple-500" />
            <SheetTitle className="text-base">{t("ai.title")}</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {bvid ? `Video: ${bvid}` : queryId ? `Query #${queryId}` : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          {state === "presets" && (
            <AIPresetSelector
              presets={presets}
              conversations={conversations}
              onSelect={handlePresetSelect}
              onResume={handleResume}
              onDelete={handleDelete}
            />
          )}

          {(state === "streaming" || state === "chat") && (
            <AIConversationView
              messages={messages}
              streamingContent={streamingContent}
              activeTools={activeTools}
              usedTools={usedTools}
              isStreaming={state === "streaming"}
              scrollContainerRef={scrollContainerRef}
            />
          )}

          {state === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 p-6">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={goBack}>
                {t("ai.backToPresets")}
              </Button>
            </div>
          )}
        </div>

        {/* Input — only in chat state */}
        {state === "chat" && (
          <AIMessageInput
            onSend={handleSendMessage}
            disabled={state !== "chat"}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
