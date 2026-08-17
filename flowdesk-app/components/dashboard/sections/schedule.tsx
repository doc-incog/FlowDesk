"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, MapPin, Plus, User } from "lucide-react"
import type { Role, ScheduleSlot, UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sun"]

type Conflict = {
  a: ScheduleSlot
  b: ScheduleSlot
  reason: "room" | "staff"
}

function overlaps(x: ScheduleSlot, y: ScheduleSlot): boolean {
  return x.start < y.end && y.start < x.end
}

function findConflicts(schedule: ScheduleSlot[]): Conflict[] {
  const conflicts: Conflict[] = []
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const a = schedule[i]
      const b = schedule[j]
      if (a.day !== b.day || !overlaps(a, b)) continue
      if (a.room === b.room) conflicts.push({ a, b, reason: "room" })
      else if (a.staff === b.staff) conflicts.push({ a, b, reason: "staff" })
    }
  }
  return conflicts
}

export function ScheduleSection({ role }: { role: Role }) {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [staff, setStaff] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [day, setDay] = useState<string>("Mon")
  const [tab, setTab] = useState<string>("routine")

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/schedule").then((r) => r.json()),
      fetch("/api/directory").then((r) => r.json()),
    ])
      .then(([s, d]) => {
        if (!alive) return
        if (s?.error) {
          setError(s.error)
        } else {
          setSchedule(s.schedule ?? [])
        }
        if (d?.error && !s?.error) setError(d.error)
        else setStaff(d?.staff ?? [])
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  const byDay = (d: string) => schedule.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start))
  const conflicts = findConflicts(schedule)

  const desc =
    role === "student"
      ? "Your weekly module routine."
      : role === "staff"
        ? "Your teaching schedule for the week."
        : "Campus-wide module routine."

  const tabs: TabItem[] = [{ id: "routine", label: "Weekly routine" }]
  if (role !== "student") {
    tabs.push({ id: "conflicts", label: `Conflicts${conflicts.length ? ` (${conflicts.length})` : ""}` })
  }
  if (role === "admin") tabs.push({ id: "add", label: "Add slot" })

  return (
    <div className="space-y-6">
      <SectionHeading title="Module routine" description={desc} />
      <SectionTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "routine" && (
        <>
          {/* Weekly grid — desktop */}
          <div className="hidden grid-cols-6 gap-4 lg:grid">
            {DAYS.map((d) => (
              <div key={d} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{d}</p>
                  <span className="pill bg-secondary text-muted-foreground">
                    {byDay(d).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {byDay(d).length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
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
            <div role="radiogroup" aria-label="Select a day" className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={day === d}
                  onClick={() => setDay(d)}
                  className={cn(
                    "shrink-0 rounded-sm px-4 py-2 text-sm font-medium transition-colors",
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
        </>
      )}

      {tab === "conflicts" && <ConflictsView conflicts={conflicts} />}

      {tab === "add" && <AddSlotView schedule={schedule} setSchedule={setSchedule} staff={staff} />}
    </div>
  )
}

function SlotCard({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
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

function ConflictsView({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) {
    return (
      <Card className="py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-3 font-semibold">No scheduling conflicts</p>
        <p className="text-sm text-muted-foreground">All rooms and faculty are free of double-bookings.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="flex items-start gap-3 border-warning/40 bg-warning/5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {conflicts.length} double-booking{conflicts.length === 1 ? "" : "s"} detected. A slot overlaps another on the
          same day in the same <b className="text-foreground">room</b> or with the same <b className="text-foreground">staff member</b>.
        </p>
      </Card>
      {conflicts.map((c, i) => (
        <Card key={i} className="border-warning/40">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-warning">
              {c.reason === "room" ? `Room ${c.a.room} double-booked` : `Staff ${c.a.staff.split(" ")[0]} double-booked`}
            </p>
            <span className="pill bg-warning/15 text-warning">
              {c.a.day} {c.a.start}–{c.a.end}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[c.a, c.b].map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="font-semibold">{s.module}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {s.code} · {s.start}–{s.end}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {s.room} · {s.staff}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function AddSlotView({
  schedule,
  setSchedule,
  staff,
}: {
  schedule: ScheduleSlot[]
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleSlot[]>>
  staff: UserProfile[]
}) {
  const modules = Array.from(new Map(schedule.map((s) => [s.code, s.module])).entries())
  const [form, setForm] = useState({
    day: "Mon",
    start: "09:00",
    end: "10:30",
    code: "",
    room: "",
    staff: staff[0]?.name ?? "",
  })
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!form.code || !form.room) {
      setError("Module and room are required.")
      return
    }
    const moduleName = modules.find(([code]) => code === form.code)?.[1] ?? ""
    const draft: ScheduleSlot = {
      id: `s${Date.now()}`,
      day: form.day,
      start: form.start,
      end: form.end,
      module: moduleName,
      code: form.code,
      room: form.room,
      staff: form.staff,
    }
    const clashes = schedule.filter(
      (s) => s.day === form.day && overlaps(s, draft) && (s.room === form.room || s.staff === form.staff),
    )
    if (clashes.length > 0) {
      setConflict(
        `Clash with ${clashes.map((c) => `${c.module} (${c.start}–${c.end})`).join(", ")} — same room or staff member.`,
      )
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setConflict(data?.error ?? "Could not save the slot.")
        return
      }
      if (data?.slot) setSchedule((prev) => [...prev, data.slot])
      setConflict(null)
      setForm((f) => ({ ...f, code: "", room: "" }))
    } catch {
      setError("Network error while saving the slot.")
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <SectionHeading title="Add a class slot" description="Conflicts are detected automatically before the slot is saved." />
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="schedule-day" className="text-sm font-medium">Day</label>
              <select id="schedule-day" value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} className={inputCls}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="schedule-start" className="text-sm font-medium">Start</label>
              <input id="schedule-start" type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="schedule-end" className="text-sm font-medium">End</label>
              <input id="schedule-end" type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="schedule-module" className="text-sm font-medium">Module</label>
            <select id="schedule-module" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputCls}>
              <option value="">Select…</option>
              {modules.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} · {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="schedule-room" className="text-sm font-medium">Room</label>
              <input id="schedule-room" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="B-204" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="schedule-faculty" className="text-sm font-medium">Faculty</label>
              <select id="schedule-faculty" value={form.staff} onChange={(e) => setForm((f) => ({ ...f, staff: e.target.value }))} className={inputCls}>
                {staff.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {conflict && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {conflict}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button
            onClick={add}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> {saving ? "Adding…" : "Add slot"}
          </button>
        </div>
      </Card>
    </div>
  )
}
