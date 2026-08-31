import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TONES = [
  { key: "positive", ink: "text-pos", fill: "bg-pos" },
  { key: "neutral", ink: "text-neu", fill: "bg-neu" },
  { key: "negative", ink: "text-neg", fill: "bg-neg" },
] as const;

/**
 * 情感三色的圖例。情感版面出現兩次同樣的詞與同樣的維度行，讀者必須看得出
 * 第二遍量的是什麼 —— 所以編碼自己要現身：詞表用墨色，橫條用色塊。
 */
export default function ToneKey({
  variant = "fill",
  className,
}: {
  variant?: "ink" | "fill";
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {TONES.map((tone) => (
        <li key={tone.key} className="flex items-center gap-1.5">
          {variant === "fill" && (
            <span aria-hidden className={cn("size-2.5 border border-rule", tone.fill)} />
          )}
          <span className={cn("text-note", variant === "ink" ? tone.ink : "text-ink-3")}>
            {t(`sentiment.${tone.key}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}
