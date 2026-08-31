import { cva } from "class-variance-authority"

/** Split out so toggle.tsx exports only a component (react-refresh). */
export const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 font-sans font-medium tracking-[0.02em] whitespace-nowrap transition-colors duration-120 outline-none hover:bg-paper-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark disabled:pointer-events-none disabled:opacity-45 aria-pressed:bg-ink aria-pressed:text-paper data-[state=on]:bg-ink data-[state=on]:text-paper [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent text-ink-2",
        outline: "border border-rule-2 bg-transparent text-ink-2 hover:border-ink",
      },
      size: {
        default: "h-8 min-w-8 px-2.5 text-note max-sm:h-9",
        sm: "h-6 min-w-6 px-2 text-note max-sm:h-8",
        lg: "h-9 min-w-9 px-3 text-ui max-sm:h-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
