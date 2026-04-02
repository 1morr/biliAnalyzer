import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIMessageInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export default function AIMessageInput({ onSend, disabled }: AIMessageInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className="flex items-end gap-2 border-t border-border px-4 py-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("ai.inputPlaceholder")}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="shrink-0"
      >
        <SendIcon className="size-4" />
      </Button>
    </div>
  );
}
