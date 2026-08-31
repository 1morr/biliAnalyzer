import { useTranslation } from "react-i18next";
import { SEP } from "@/lib/format";
import { DeleteMark } from "@/components/proof/marks";
import type { AIPreset, AIConversation } from "@/types";

interface AIPresetSelectorProps {
  presets: AIPreset[];
  conversations: AIConversation[];
  onSelect: (presetId: string) => void;
  onResume: (convId: number) => void;
  onDelete: (convId: number) => void;
}

/** 選題單 —— what to ask the editor for, and the notes already on file. */
export default function AIPresetSelector({
  presets,
  conversations,
  onSelect,
  onResume,
  onDelete,
}: AIPresetSelectorProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-7 px-4 py-4">
      <section>
        <h4 className="column-label border-b border-rule-strong pb-1.5">{t("ai.newAnalysis")}</h4>
        <ul>
          {presets.map((preset) => (
            <li key={preset.id} className="border-b border-rule">
              <button
                type="button"
                onClick={() => onSelect(preset.id)}
                className="group w-full py-2.5 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
              >
                <p className="font-song text-ui font-semibold text-ink group-hover:text-mark">
                  {t(preset.labelKey)}
                </p>
                <p className="mt-0.5 text-note leading-relaxed text-ink-2">
                  {t(preset.descriptionKey)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="column-label border-b border-rule-strong pb-1.5">{t("ai.conversations")}</h4>
        {conversations.length === 0 ? (
          <p className="py-3 text-note text-ink-3">{t("ai.noConversations")}</p>
        ) : (
          <ul>
            {conversations.map((conv) => (
              <li key={conv.id} className="group relative border-b border-rule">
                <button
                  type="button"
                  onClick={() => onResume(conv.id)}
                  className="w-full py-2 pr-8 text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
                >
                  <p className="truncate text-ui text-ink">{conv.title || `#${conv.id}`}</p>
                  <p className="mt-0.5 text-colophon tabular-nums text-ink-3">
                    {new Date(conv.created_at).toLocaleDateString(
                      i18n.language.startsWith("zh") ? "zh-CN" : "en-US",
                    )}
                    {SEP}
                    {t("ai.messageCount", { n: conv.message_count })}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="absolute top-2 right-1 p-1 text-ink-3 opacity-0 transition-opacity hover:text-mark focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={t("ai.deleteConversation")}
                >
                  <DeleteMark className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
