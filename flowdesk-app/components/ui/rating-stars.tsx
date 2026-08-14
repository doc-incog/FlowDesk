"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function RatingStars({
  value,
  onChange,
  size = "h-5 w-5",
}: {
  value: number
  onChange?: (v: number) => void
  size?: string
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={cn("transition-colors", onChange && "hover:scale-110", !onChange && "cursor-default")}
        >
          <Star
            className={cn(size, "transition-colors", n <= value ? "fill-warning text-warning" : "text-border")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}
