"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"

export type TabItem = { id: string; label: string }

export function SectionTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const moveFocus = (from: number, dir: 1 | -1) => {
    const next = (from + dir + tabs.length) % tabs.length
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")
    buttons?.[next]?.focus()
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Views"
      className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border"
    >
      {tabs.map((t, i) => (
        <button
          key={t.id}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          tabIndex={active === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault()
              moveFocus(i, 1)
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              moveFocus(i, -1)
            } else if (e.key === "Home") {
              e.preventDefault()
              ref.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")?.[0]?.focus()
            } else if (e.key === "End") {
              e.preventDefault()
              const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")
              buttons?.[buttons.length - 1]?.focus()
            }
          }}
          className={cn(
            "-mb-px border-b-2 pb-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
            active === t.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
