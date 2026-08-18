"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Fingerprint, Search, Calendar } from "lucide-react"
import type { CheckInRecord, Role } from "@/lib/seed-data/core"
import { BiometricScanner } from "@/components/biometric-scanner"
import { Card, RoleBadge, SectionHeading, StatusBadge } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

type HistoryRecord = {
  id: string
  name: string
  role: string
  date: string
  time: string
  status: "on-time" | "late" | "absent"
  method: string
  source: string
}

type HistorySummary = {
  total: number
  present: number
  late: number
  absent: number
  percentage: number
}

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function CheckInSection({ role, userName }: { role: Role; userName: string }) {
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkinError, setCheckinError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Date picker for daily log
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // History state
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([])
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyFrom, setHistoryFrom] = useState("")
  const [historyTo, setHistoryTo] = useState("")

  // Admin role filter
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "staff">("all")

  // Fetch daily records when date changes
  useEffect(() => {
    let alive = true
    fetch(`/api/checkins?date=${selectedDate}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j?.error) setError(j.error)
        else setRecords(j?.records ?? [])
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [selectedDate])

  // Derive checkedIn from records instead of using a separate effect
  const checkedIn = role === "student" && selectedDate === todayStr() && records.length > 0

  const doFetchHistory = () => {
    setHistoryLoading(true)
    setHistoryError(null)
    const params = new URLSearchParams()
    if (historyFrom) params.set("from", historyFrom)
    if (historyTo) params.set("to", historyTo)
    if (role === "admin" && roleFilter !== "all") params.set("role", roleFilter)

    fetch(`/api/checkins/history?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.error) setHistoryError(j.error)
        else {
          setHistoryRecords(j?.records ?? [])
          setHistorySummary(j?.summary ?? null)
        }
      })
      .catch(() => setHistoryError("Failed to load history"))
      .finally(() => setHistoryLoading(false))
  }

  const handleVerified = async (method: "webauthn" | "biometric") => {
    if (checkedIn || busy) return
    setBusy(true)
    setCheckinError(null)
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (data?.record || data?.alreadyCheckedIn) {
        if (data?.record) setRecords((prev) => [data.record, ...prev])
      } else {
        setCheckinError(data?.error ?? "Check-in failed")
      }
    } catch {
      setCheckinError("Check-in failed")
    } finally {
      setBusy(false)
    }
  }

  if (loading && records.length === 0) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  const present = records.filter((r) => r.status === "on-time").length
  const late = records.filter((r) => r.status === "late").length
  const absent = records.filter((r) => r.status === "absent").length
  const total = records.length
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  const inputCls =
    "rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="space-y-6">
      <SectionHeading
        title={role === "student" ? "Biometric check-in" : role === "staff" ? "Mentee attendance" : "Attendance overview"}
        description={
          role === "student"
            ? "Place your finger on the scanner to record attendance."
            : role === "staff"
              ? "View attendance records for your mentees."
              : "View and filter attendance records for all users."
        }
      />

      {/* Scanner — student only */}
      {role === "student" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="flex flex-col items-center justify-center gap-6 py-10 lg:col-span-2">
            {checkedIn ? (
              <div role="status" className="flex flex-col items-center gap-4 text-center">
                <span className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-success bg-success/10">
                  <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
                </span>
                <div>
                  <p className="text-lg font-bold text-success">You&apos;re checked in</p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{userName} · {nowTime()}</p>
                </div>
              </div>
            ) : (
              <>
                {checkinError && (
                  <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {checkinError}
                  </p>
                )}
                <BiometricScanner label="Tap to check in" onVerified={handleVerified} />
                <p className="max-w-xs text-center text-xs text-muted-foreground">
                  Demo simulation: your fingerprint template never leaves the device — only a pass/fail signal is recorded.
                </p>
              </>
            )}
          </Card>

          {/* Personal stats for student */}
          <div className="space-y-4 lg:col-span-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-xl font-bold">{present}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
                  <Clock className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-xl font-bold">{late}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
                  <Fingerprint className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-xl font-bold">{absent}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
                  <Fingerprint className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-xl font-bold">{percentage}%</p>
                  <p className="text-xs text-muted-foreground">Attendance</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Stats for staff/admin */}
      {role !== "student" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-mono text-xl font-bold">{historySummary?.present ?? present}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
              <Clock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-mono text-xl font-bold">{historySummary?.late ?? late}</p>
              <p className="text-xs text-muted-foreground">Late</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
              <Fingerprint className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-mono text-xl font-bold">{historySummary?.absent ?? absent}</p>
              <p className="text-xs text-muted-foreground">Absent</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
              <Fingerprint className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-mono text-xl font-bold">{historySummary?.percentage ?? percentage}%</p>
              <p className="text-xs text-muted-foreground">Attendance</p>
            </div>
          </Card>
        </div>
      )}

      {/* Date picker for daily log */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
          <label htmlFor="checkin-date" className="text-sm font-medium">
            {role === "student" ? "Your attendance for:" : "Attendance for:"}
          </label>
          <input
            id="checkin-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(inputCls, "font-mono")}
          />
        </div>
      </Card>

      {/* Daily log table */}
      <Card>
        <SectionHeading
          title={role === "student" ? "Your check-in record" : "Today's check-in log"}
          description={`${records.length} entr${records.length === 1 ? "y" : "ies"} · ${selectedDate}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                {role !== "student" && <th className="pb-2 font-medium">Role</th>}
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={role !== "student" ? 5 : 4} className="py-2.5 text-center text-muted-foreground">No check-ins for this date yet.</td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 font-medium">{r.name}</td>
                    {role !== "student" && (
                      <td className="py-2.5"><RoleBadge role={r.role} /></td>
                    )}
                    <td className="py-2.5 font-mono text-muted-foreground">{r.time}</td>
                    <td className="py-2.5 capitalize text-muted-foreground">{r.method}</td>
                    <td className="py-2.5 text-right"><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Attendance History / Search Section */}
      <Card className="space-y-4">
        <SectionHeading
          title={role === "student" ? "Attendance history" : "Attendance history & search"}
          description={
            role === "student"
              ? "Search your past attendance records by date range."
              : role === "staff"
                ? "Search mentee attendance records by date range."
                : "Search all attendance records by date range and role."
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="hist-from" className="text-xs font-medium text-muted-foreground">From</label>
            <input
              id="hist-from"
              type="date"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              className={cn(inputCls, "font-mono")}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hist-to" className="text-xs font-medium text-muted-foreground">To</label>
            <input
              id="hist-to"
              type="date"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              className={cn(inputCls, "font-mono")}
            />
          </div>
          {role === "admin" && (
            <div className="space-y-1.5">
              <label htmlFor="hist-role" className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                id="hist-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "all" | "student" | "staff")}
                className={inputCls}
              >
                <option value="all">All users</option>
                <option value="student">Students only</option>
                <option value="staff">Staff only</option>
              </select>
            </div>
          )}
          <button
            onClick={doFetchHistory}
            disabled={historyLoading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden /> {historyLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* History summary */}
        {historySummary && (
          <div className="flex flex-wrap gap-4 rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
            <span className="font-medium">{historySummary.total} total records</span>
            <span className="text-success">{historySummary.present} present</span>
            <span className="text-chart-5">{historySummary.late} late</span>
            <span className="text-destructive">{historySummary.absent} absent</span>
            <span className="font-semibold text-primary">{historySummary.percentage}% attendance</span>
          </div>
        )}

        {/* History table */}
        {historyLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Loading history…</p>
        ) : historyError ? (
          <p role="alert" className="text-sm text-destructive">{historyError}</p>
        ) : historyRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Date</th>
                  {role === "admin" && <th className="pb-2 font-medium">Name</th>}
                  {role === "admin" && <th className="pb-2 font-medium">Role</th>}
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 font-mono text-muted-foreground">{r.date}</td>
                    {role === "admin" && <td className="py-2.5 font-medium">{r.name}</td>}
                    {role === "admin" && (
                      <td className="py-2.5"><RoleBadge role={r.role} /></td>
                    )}
                    <td className="py-2.5 font-mono text-muted-foreground">{r.time}</td>
                    <td className="py-2.5 capitalize text-muted-foreground">{r.method}</td>
                    <td className="py-2.5 text-right"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {historyFrom || historyTo ? "No records found for the selected date range." : "Click Search to load your attendance history."}
          </p>
        )}
      </Card>
    </div>
  )
}
