import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/** 填寫欄：底線在下，像稿紙上待填的那一格；聚焦時線變朱批。 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 border border-rule-2 bg-transparent px-2.5 py-1 font-sans text-ui text-ink transition-colors outline-none max-sm:h-10",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-note file:font-medium file:text-ink",
        "placeholder:text-ink-3 focus-visible:border-mark focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mark/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-55",
        "aria-invalid:border-mark",
        className
      )}
      {...props}
    />
  )
}

export { Input }
