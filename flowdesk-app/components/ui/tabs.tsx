"use client"

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
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            active === t.id ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
