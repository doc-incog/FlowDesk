"use client"

import { useState } from "react"
import { MapPin, User } from "lucide-react"
import { SCHEDULE, type Role, type ScheduleSlot } from "@/lib/mock-data"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]

const MODULE_TONE: Record<string, string> = {
  CS301: "border-l-chart-1",
  CS302: "border-l-chart-2",
  CS303: "border-l-chart-3",
  CS304: "border-l-chart-4",
  CS305: "border-l-chart-5",
  CS306: "border-l-primary",
}

export function ScheduleSection({ role }: { role: Role }) {
  const [day, setDay] = useState<string>("Mon")
  const byDay = (d: string) => SCHEDULE.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start))
  const desc =
    role === "student"
      ? "Your weekly module routine."
      : role === "staff"
        ? "Your teaching schedule for the week."
        : "Campus-wide module routine."

  return (
    <div className="space-y-6">
      <SectionHeading title="Module routine" description={desc} />

      {/* Weekly grid — desktop */}
      <div className="hidden grid-cols-5 gap-4 lg:grid">
        {DAYS.map((d) => (
          <div key={d} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{d}</p>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {byDay(d).length}
              </span>
            </div>
            <div className="space-y-3">
              {byDay(d).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No classes
                </div>
              ) : (
                byDay(d).map((s) => <SlotCard key={s.id} slot={s} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Day picker — mobile */}
      <div className="lg:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                day === d ? "bg-primary text-primary-foreground" : "border border-border bg-card",
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {byDay(day).length === 0 ? (
            <Card className="py-8 text-center text-sm text-muted-foreground">No classes scheduled.</Card>
          ) : (
            byDay(day).map((s) => <SlotCard key={s.id} slot={s} />)
          )}
        </div>
      </div>
    </div>
  )
}

function SlotCard({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className={cn("rounded-xl border border-l-4 border-border bg-card p-4", MODULE_TONE[slot.code] ?? "border-l-primary")}>
      <p className="font-mono text-xs font-semibold text-muted-foreground">
        {slot.start} – {slot.end}
      </p>
      <p className="mt-1 font-semibold leading-tight text-balance">{slot.module}</p>
      <p className="font-mono text-xs text-muted-foreground">{slot.code}</p>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" aria-hidden /> Room {slot.room}
        </p>
        <p className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" aria-hidden /> {slot.staff}
        </p>
      </div>
    </div>
  )
}
