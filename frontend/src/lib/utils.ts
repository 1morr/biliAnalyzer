import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The sheet's type scale and its ink palette both live under `text-*`, and
 * tailwind-merge cannot tell `text-ui` (a 號數) from `text-ink` (a colour)
 * without being told — it collapses them into one group and silently drops the
 * first, which is how a button ends up as ink on ink. Teach it the two sets.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "h1",
            "h2",
            "h3",
            "h4",
            "body",
            "ui",
            "note",
            "colophon",
          ],
        },
      ],
      "text-color": [
        {
          text: [
            "paper",
            "paper-2",
            "paper-3",
            "ink",
            "ink-2",
            "ink-3",
            "rule",
            "rule-2",
            "rule-strong",
            "mark",
            "mark-ink",
            "pencil",
            "pos",
            "neu",
            "neg",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
