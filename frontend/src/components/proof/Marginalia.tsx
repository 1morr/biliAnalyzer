import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 旁批 —— the signature move, and an actual margin rather than an overlay.
 *
 * The sheet stays lit and readable: no backdrop, no dimming, the content column
 * gives up its right edge (`--note-margin`, read by <main>) so the note sits
 * BESIDE the figure it annotates rather than on top of it. What the note was
 * pulled from is said by its own head, and — where the trigger can hold it —
 * by the 朱批 wash left on the figure that was clicked.
 *
 * Below the reflow width there is no margin to reserve, so the note covers the
 * sheet: a phone has no margin to write in.
 */

const REFLOW = "(min-width: 1024px)";

/** The empty lane kept between the content column and the note. */
const GUTTER = 48;

export default function Marginalia({
  open,
  onOpenChange,
  subject,
  meta,
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: React.ReactNode;
  meta?: React.ReactNode;
  /** Wider margin for conversation-length material. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const width = wide ? "38rem" : "27rem";

  // Reserve the margin plus an empty gutter; <main> reflows into --note-margin.
  React.useEffect(() => {
    const root = document.documentElement;
    if (!open) {
      root.style.removeProperty("--note-margin");
      return;
    }
    const mq = window.matchMedia(REFLOW);
    const apply = () =>
      root.style.setProperty("--note-margin", mq.matches ? `calc(${width} + ${GUTTER}px)` : "0px");
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      root.style.removeProperty("--note-margin");
    };
  }, [open, width]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Popup
          data-slot="marginalia"
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-rule-strong bg-paper text-ui text-ink shadow-sheet outline-none",
            "transition-[transform,opacity] duration-220 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-starting-style:translate-x-6 data-starting-style:opacity-0",
            "data-ending-style:translate-x-6 data-ending-style:opacity-0",
            wide
              ? "sm:w-[min(38rem,92vw)] sm:max-w-[min(38rem,92vw)]"
              : "sm:w-[min(27rem,92vw)] sm:max-w-[min(27rem,92vw)]",
          )}
        >
          {/* 批註的頭與整張紙的頭線同高同粗：開在版邊時，那條線仍是一條。 */}
          <div className="flex min-h-[var(--head-h)] shrink-0 items-center justify-between gap-3 border-b-2 border-rule-strong px-4 py-2">
            <div className="min-w-0">
              <Dialog.Title className="font-song text-h3 leading-tight font-semibold text-mark">
                {subject}
              </Dialog.Title>
              {meta && <p className="mt-0.5 text-note text-ink-3">{meta}</p>}
            </div>
            <Dialog.Close render={<Button variant="ghost" size="icon-sm" className="-mr-1 -mt-0.5" />}>
              <XIcon />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
