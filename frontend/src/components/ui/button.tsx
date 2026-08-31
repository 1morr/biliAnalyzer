import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 排版式按鈕：方角、欄線邊、墨色塊。
 * `mark` 是編輯的手（朱批），留給真正推進工作的那一個動作。
 * 小螢幕上每個控制項至少 40px 高 —— 桌機的密度不該由手指買單。
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border font-sans font-medium tracking-[0.02em] whitespace-nowrap transition-colors duration-120 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-ink bg-ink text-paper hover:border-mark hover:bg-mark hover:text-mark-ink",
        outline:
          "border-rule-2 bg-transparent text-ink hover:border-ink hover:bg-paper-3 aria-expanded:border-ink aria-expanded:bg-paper-3",
        secondary:
          "border-rule bg-paper-2 text-ink hover:border-rule-2 hover:bg-paper-3 aria-expanded:bg-paper-3",
        ghost:
          "border-transparent bg-transparent text-ink-2 hover:bg-paper-3 hover:text-ink aria-expanded:bg-paper-3 aria-expanded:text-ink",
        destructive:
          "border-mark bg-transparent text-mark hover:bg-mark hover:text-mark-ink",
        link: "border-transparent text-ink underline underline-offset-[0.22em] decoration-rule-2 hover:text-mark hover:decoration-mark",
      },
      size: {
        default: "h-8 gap-1.5 px-3 text-ui max-sm:h-10 max-sm:px-3.5",
        xs: "h-6 gap-1 px-2 text-note [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-note max-sm:h-9 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-4 text-ui max-sm:h-11",
        icon: "size-8 max-sm:size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 max-sm:size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9 max-sm:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
