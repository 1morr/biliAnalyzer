import { Figure } from "@/components/proof/Sheet";
import { cn } from "@/lib/utils";

export interface LedgerRow {
  /** True while this figure's note is open in the margin. */
  open?: boolean;
  key: string;
  label: string;
  /** Already formatted for display. */
  value: string;
  /** Exact figure for the title attribute. */
  exact?: string;
  marked?: boolean;
}

/**
 * 統計欄 —— figures in one ruled row. Not cards, and not one hue per figure:
 * views and likes have no natural colour, so ink carries all of them.
 */
export default function Ledger({
  rows,
  className,
  onFigureClick,
}: {
  rows: LedgerRow[];
  className?: string;
  /** Present when the figure can be pulled into the margin. */
  onFigureClick?: (row: LedgerRow) => void;
}) {
  return (
    // The container is the wrapper: an element cannot query its own container,
    // and the open note narrows this column without changing the viewport.
    <div className={cn("@container", className)}>
      <dl
        className={cn(
          "grid grid-cols-2 border-y border-rule @md:grid-cols-4",
          rows.length > 4 && "@5xl:grid-cols-8",
        )}
      >
      {rows.map((r) => {
        const cell = cn(
          "border-rule px-3 py-3 whitespace-nowrap not-first:border-l",
          "@max-md:nth-[2n+1]:border-l-0 @max-md:nth-[n+3]:border-t",
          rows.length > 4
            ? "@md:@max-5xl:nth-[4n+1]:border-l-0 @md:@max-5xl:nth-[n+5]:border-t"
            : "@md:nth-[4n+1]:border-l-0",
        );
        const figure = <Figure label={r.label} value={r.value} marked={r.marked || r.open} />;
        return onFigureClick ? (
          <button
            key={r.key}
            type="button"
            onClick={() => onFigureClick(r)}
            className={cn(
              cell,
              "text-left outline-none hover:bg-paper-2 focus-visible:bg-paper-2",
              r.open && "bg-mark-wash",
            )}
            title={r.exact}
          >
            {figure}
          </button>
        ) : (
          <div key={r.key} className={cell} title={r.exact}>
            {figure}
          </div>
        );
      })}
      </dl>
    </div>
  );
}
