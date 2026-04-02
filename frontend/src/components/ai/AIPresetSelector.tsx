import { useTranslation } from "react-i18next";
import { BarChart3Icon, LightbulbIcon, VideoIcon, MessageSquareIcon, Trash2Icon } from "lucide-react";
import type { AIPreset, AIConversation } from "@/types";

const PRESET_ICONS: Record<string, typeof BarChart3Icon> = {
  overall_analysis: BarChart3Icon,
  topic_inspiration: LightbulbIcon,
  video_analysis: VideoIcon,
};

interface AIPresetSelectorProps {
  presets: AIPreset[];
  conversations: AIConversation[];
  onSelect: (presetId: string) => void;
  onResume: (convId: number) => void;
  onDelete: (convId: number) => void;
}

export default function AIPresetSelector({
  presets, conversations, onSelect, onResume, onDelete,
}: AIPresetSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Preset cards */}
      <div className="text-sm font-medium text-muted-foreground">{t("ai.newAnalysis")}</div>
      <div className="grid gap-2">
        {presets.map((preset) => {
          const Icon = PRESET_ICONS[preset.id] || BarChart3Icon;
          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-purple-500" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{t(preset.labelKey)}</div>
                <div className="text-xs text-muted-foreground">{t(preset.descriptionKey)}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Conversation history */}
      {conversations.length > 0 && (
        <>
          <div className="text-sm font-medium text-muted-foreground mt-2">{t("ai.conversations")}</div>
          <div className="flex flex-col gap-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer"
              >
                <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <button
                  onClick={() => onResume(conv.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm truncate">{conv.title || `#${conv.id}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(conv.created_at).toLocaleDateString()} · {conv.message_count} msgs
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {conversations.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-2">
          {t("ai.noConversations")}
        </div>
      )}
    </div>
  );
}
