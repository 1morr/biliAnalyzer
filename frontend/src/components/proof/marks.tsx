/**
 * 校對記號 —— the editor's own marks. lucide has no vocabulary for these, so
 * they are drawn here in lucide's grammar (16 grid, 1.5 stroke, round caps)
 * and sit beside its icons without a seam.
 */

type MarkProps = { className?: string; strokeWidth?: number };

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** 刪除記號：一圈帶尾的刪符，橫貫要去掉的字。 */
export function DeleteMark({ className, strokeWidth = 1.5 }: MarkProps) {
  return (
    <svg {...base} className={className} strokeWidth={strokeWidth}>
      <path d="M2.5 8h11" />
      <path d="M9.5 4.2c-2.4-.9-4 .6-3.4 2.3.5 1.5 3 2.3 4.2 1.1.9-.9.6-2.4-.8-3.4" />
    </svg>
  );
}

/** 調位記號：交換前後兩處的 S 形轉記。 */
export function TransposeMark({ className, strokeWidth = 1.5 }: MarkProps) {
  return (
    <svg {...base} className={className} strokeWidth={strokeWidth}>
      <path d="M3 5h4a2.2 2.2 0 0 1 0 4.4H3" />
      <path d="M13 11H9a2.2 2.2 0 0 1 0-4.4h4" />
    </svg>
  );
}

/** 圈選記號：圈起這一處，交給旁批說話。 */
export function CircleMark({ className, strokeWidth = 1.5 }: MarkProps) {
  return (
    <svg {...base} className={className} strokeWidth={strokeWidth}>
      <path d="M11.4 4.3C9.6 2.6 5.8 2.9 4.1 5.2c-1.7 2.3-.5 5.6 2.3 6.5 2.9.9 6-.9 6.2-3.5.1-1.2-.4-2.3-1.4-3.1" />
    </svg>
  );
}

/** 補字記號：插入號，指向要補上的位置。 */
export function InsertMark({ className, strokeWidth = 1.5 }: MarkProps) {
  return (
    <svg {...base} className={className} strokeWidth={strokeWidth}>
      <path d="M3 10.5h10" />
      <path d="M5.5 10.5 8 5.5l2.5 5" />
    </svg>
  );
}
