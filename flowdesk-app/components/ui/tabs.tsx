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
    <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px border-b-2 pb-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
            active === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
