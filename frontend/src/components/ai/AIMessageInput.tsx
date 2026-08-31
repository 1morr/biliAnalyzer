import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIMessageInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

/** 追問欄：稿紙最下面待填的那一行。 */
export default function AIMessageInput({ onSend, disabled }: AIMessageInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 132;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, [value]);

  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-rule-strong bg-paper-2 px-4 py-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("ai.inputPlaceholder")}
        disabled={disabled}
        rows={1}
        aria-label={t("ai.inputPlaceholder")}
        className="flex-1 resize-none border border-rule-2 bg-paper px-2.5 py-2 font-sans text-ui leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus-visible:border-mark focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mark/40 disabled:opacity-50"
      />
      <Button
        size="icon"
        variant="default"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label={t("ai.sendMessage")}
      >
        <SendIcon className="size-4" />
      </Button>
    </div>
  );
}
