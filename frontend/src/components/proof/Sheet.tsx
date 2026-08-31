import * as React from "react";
import { SEP } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 版面元件 —— the typographic vocabulary of the proof sheet. Column rules and
 * ink weight carry the hierarchy; there are no cards and no rounded corners.
 */

/** 一節：以花邊（雙線）與上方的欄標題起頭。 */
export function Section({
  label,
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { label?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col", className)} {...props}>
      {(label || action) && (
        <div className="rule-double flex items-baseline justify-between gap-4 pt-3 pb-4">
          {label && (
            <h2 className="font-song text-h4 leading-none font-semibold text-ink">{label}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** 一欄：左側欄線分隔，取代卡片邊框。 */
export function Column({
  label,
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props}>
      {(label || action) && (
        <div className="flex min-h-6 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {label && <h3 className="column-label font-sans">{label}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * 分欄容器：欄與欄之間畫欄線，而不是把每欄裝進盒子。
 * `divide-x` 只在同一列生效，換行時交給 row-gap 的花邊。
 */
export function Columns({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-8 [&>*+*]:border-rule sm:[&>*+*]:border-l sm:[&>*+*]:pl-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 數據項：標籤在上、數字在下，靠字級與墨色分層，不靠顏色。
 * `mark` 只留給真正被編輯圈起來的那一項。
 */
export function Figure({
  label,
  value,
  note,
  marked = false,
  size = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  marked?: boolean;
  size?: "default" | "lead";
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)} {...props}>
      <span className="column-label font-sans">{label}</span>
      <span
        className={cn(
          "font-sans leading-none tabular-nums",
          size === "lead" ? "text-h2 font-semibold" : "text-h4 font-medium",
          marked ? "text-mark" : "text-ink",
        )}
      >
        {value}
      </span>
      {note && <span className="text-note text-ink-3 leading-tight">{note}</span>}
    </div>
  );
}

/** 著重號：中文原生的強調。用於導言句裡的關鍵數字。 */
export function Emphasis({ children }: { children?: React.ReactNode }) {
  return <em className="zhuozhong not-italic font-semibold text-ink">{children}</em>;
}

/** 版邊版權標記行：抓取時間、資料版次、篩選印次沿底緣排。 */
export function Colophon({ items }: { items: (string | null | undefined)[] }) {
  const kept = items.filter(Boolean) as string[];
  if (!kept.length) return null;
  return (
    <p className="colophon border-t border-rule pt-2 font-sans">
      {kept.join(SEP)}
    </p>
  );
}

/** 逐欄上墨：載入時的顯影，不是骨架屏閃爍。 */
export function InkIn({
  delay = 0,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { delay?: number }) {
  return (
    <div
      className={className}
      style={{ animation: `ink-in 380ms cubic-bezier(0.16,1,0.3,1) ${delay}ms both` }}
      {...props}
    >
      {children}
    </div>
  );
}
