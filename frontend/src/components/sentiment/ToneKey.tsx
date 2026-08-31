import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TONES = [
  { key: "positive", fill: "bg-pos" },
  { key: "neutral", fill: "bg-neu" },
  { key: "negative", fill: "bg-neg" },
] as const;

/**
 * 情感三色的圖例。受眾維度那四個維度在上一節已經排過一次，這裡量的是別的
 * 東西，色塊就得當場說明自己是誰。標籤走 ink-3：中性墨太淡，撐不起文字。
 */
export default function ToneKey({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {TONES.map((tone) => (
        <li key={tone.key} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 border border-rule", tone.fill)} />
          <span className="text-note text-ink-3">{t(`sentiment.${tone.key}`)}</span>
        </li>
      ))}
    </ul>
  );
}
