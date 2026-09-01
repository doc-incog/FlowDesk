"use client"

import { useEffect, useState, useRef } from "react"
import { CheckCircle2, Clock, Fingerprint, Search, Calendar, Wifi, WifiOff, Loader2 } from "lucide-react"
import type { CheckInRecord, Role, UserProfile } from "@/lib/seed-data/core"
import { Card, RoleBadge, SectionHeading, StatusBadge } from "@/components/dashboard/primitives"
import { FingerprintEnrollmentWizard } from "@/components/dashboard/sections/fingerprint-enrollment-wizard"
import { cn } from "@/lib/utils"

type HistoryRecord = {
  id: string
  userId?: string
  name: string
  role: string
  date: string
  time: string
  status: "on-time" | "late" | "absent"
  method: string
  source: string
}

type PersonOption = { id: string; name: string; role: string; semester?: string | null }

type HistorySummary = {
  total: number
  present: number
  late: number
  absent: number
  percentage: number
}

type Device = {
  device_id: string
  label: string
  location: string
  last_seen: string | null
  enrolled_count: number
  slots_total: number
}

type FpEnrollment = {
  id: string
  fingerId: number
  deviceId: string
  label: string
  location: string
  enrolledAt: string
}

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function CheckInSection({ role, userName, userId }: { role: Role; userName: string; userId?: string }) {
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Per-person history (staff: mentees, admin: anyone)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [personId, setPersonId] = useState("")
  const [personQuery, setPersonQuery] = useState("")

  // Manual attendance marking (staff, when the fingerprint scanner is down)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)
  const [manFilterSemester, setManFilterSemester] = useState("")
  const [manFilterName, setManFilterName] = useState("")

  // Fingerprint state (student only)
  const [fpEnrolled, setFpEnrolled] = useState<boolean | null>(null)
  const [fpEnrollments, setFpEnrollments] = useState<FpEnrollment[]>([])
  const [fpDevices, setFpDevices] = useState<Device[]>([])
  const [showWizard, setShowWizard] = useState(false)
  const checkinPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Load fingerprint status for students
  useEffect(() => {
    if (role !== "student" || !userId) return
    let alive = true

    const loadFpStatus = async () => {
      try {
        const [statusRes, devicesRes] = await Promise.all([
          fetch(`/api/fingerprint/enroll/status?userId=${encodeURIComponent(userId)}`),
          fetch("/api/fingerprint/devices"),
        ])
        const statusData = await statusRes.json()
        const devicesData = await devicesRes.json()

        if (!alive) return
        setFpEnrolled(statusData.enrolled ?? false)
        setFpEnrollments(statusData.enrollments ?? [])
        setFpDevices(devicesData.devices ?? [])
      } catch {
        if (alive) setFpEnrolled(false)
      }
    }

    loadFpStatus()
    return () => { alive = false }
  }, [role, userId])

  // Auto-refresh when enrolled but not checked in today
  const checkedIn = role === "student" && selectedDate === todayStr() && records.length > 0

  useEffect(() => {
    if (role !== "student" || checkedIn || !fpEnrolled) {
      if (checkinPollRef.current) { clearInterval(checkinPollRef.current); checkinPollRef.current = null }
      return
    }

    checkinPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkins?date=${todayStr()}`)
        const data = await res.json()
        if (data?.records?.length > 0) {
          setRecords(data.records)
          if (checkinPollRef.current) { clearInterval(checkinPollRef.current); checkinPollRef.current = null }
        }
      } catch {
        // retry
      }
    }, 10000)

    return () => { if (checkinPollRef.current) { clearInterval(checkinPollRef.current); checkinPollRef.current = null } }
  }, [role, checkedIn, fpEnrolled])

  // Load the people that can be inspected
  useEffect(() => {
    if (role === "student") return
    let alive = true
    fetch(role === "staff" ? "/api/mentor" : "/api/directory")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || d?.error) return
        let list: PersonOption[] = []
        if (role === "staff") {
          // Staff see the students they mentor (authoritative via /api/mentor)
          list = ((d.mentees ?? []) as UserProfile[]).map((s) => ({
            id: s.id,
            name: s.name,
            role: "student",
            semester: s.semester,
          }))
        } else {
          const students = (d?.students ?? []) as UserProfile[]
          const staff = (d?.staff ?? []).map((s: UserProfile) => ({ id: s.id, name: s.name, role: s.role }))
          list = [
            ...students.map((s) => ({ id: s.id, name: s.name, role: "student" as const, semester: s.semester })),
            ...staff,
          ]
        }
        setPeople(list.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [role])

  const doFetchHistory = (opts?: { userId?: string }) => {
    setHistoryLoading(true)
    setHistoryError(null)
    const uid = opts?.userId ?? personId
    const params = new URLSearchParams()
    if (historyFrom) params.set("from", historyFrom)
    if (historyTo) params.set("to", historyTo)
    if (uid) params.set("userId", uid)
    else if (role === "admin" && roleFilter !== "all") params.set("role", roleFilter)
    else if (personQuery.trim()) params.set("name", personQuery.trim())

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

  const selectPerson = (id: string) => {
    setPersonId(id)
    if (id) {
      doFetchHistory({ userId: id })
    } else {
      setHistoryRecords([])
      setHistorySummary(null)
      setHistoryError(null)
    }
  }

  const handleWizardComplete = async () => {
    setShowWizard(false)
    // Refresh fingerprint status
    if (userId) {
      try {
        const res = await fetch(`/api/fingerprint/enroll/status?userId=${encodeURIComponent(userId)}`)
        const data = await res.json()
        setFpEnrolled(data.enrolled ?? false)
        setFpEnrollments(data.enrollments ?? [])
      } catch { /* silent */ }
    }
  }

  const handleManualMark = async (studentId: string, status: "present" | "late" | "absent") => {
    setMarkingId(studentId)
    setMarkError(null)
    try {
      const res = await fetch("/api/checkins/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMarkError(data?.error ?? "Could not mark attendance.")
        return
      }
      if (data?.record) {
        setRecords((prev) => {
          const rest = prev.filter((r) => r.userId !== studentId)
          return [data.record, ...rest]
        })
      }
    } catch {
      setMarkError("Network error while marking attendance.")
    } finally {
      setMarkingId(null)
    }
  }

  if (loading && records.length === 0) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  const present = records.filter((r) => r.status === "on-time").length
  const late = records.filter((r) => r.status === "late").length
  const absent = records.filter((r) => r.status === "absent").length
  const total = records.length
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0
  const selectedPerson = people.find((p) => p.id === personId)
  const filteredPeople = personQuery.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(personQuery.toLowerCase()))
    : people

  // The manual-marking panel is only useful on today's view: map each mentee's
  // current status from today's check-ins (people without a row are unmarked).
  const isToday = selectedDate === todayStr()
  const todayStatusMap = new Map<string, "on-time" | "late" | "absent">()
  if (isToday && role === "staff") {
    for (const r of records) {
      if (r.userId && (r.status === "on-time" || r.status === "late" || r.status === "absent")) {
        todayStatusMap.set(r.userId, r.status)
      }
    }
  }

  // Manual-marking filters: narrow the mentee list by semester and/or name so the
  // staff member only sees the students they actually want to mark today.
  const manSemesters = Array.from(
    new Set(people.map((p) => p.semester ?? "").filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const manFiltered = people.filter((p) => {
    if (manFilterSemester && (p.semester ?? "") !== manFilterSemester) return false
    if (manFilterName.trim() && !p.name.toLowerCase().includes(manFilterName.trim().toLowerCase())) return false
    return true
  })

  const inputCls =
    "rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="space-y-6">
      <SectionHeading
        title={role === "student" ? "Fingerprint check-in" : role === "staff" ? "Mentee attendance" : "Attendance overview"}
        description={
          role === "student"
            ? "Use the fingerprint sensor to record your attendance."
            : role === "staff"
              ? "View attendance records for your mentees."
              : "View and filter attendance records for all users."
        }
      />

      {/* Student sensor status */}
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
            ) : showWizard ? (
              <FingerprintEnrollmentWizard
                userId={userId ?? ""}
                userName={userName}
                devices={fpDevices}
                onComplete={handleWizardComplete}
                onCancel={() => setShowWizard(false)}
              />
            ) : fpEnrolled === false ? (
              /* Not enrolled — show registration prompt */
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-secondary/50">
                  <Fingerprint className="h-11 w-11 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-semibold">No fingerprint registered</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Register your fingerprint at a sensor device to check in.
                  </p>
                </div>
                <button
                  onClick={() => setShowWizard(true)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Fingerprint className="h-4 w-4" /> Register Fingerprint
                </button>
              </div>
            ) : fpEnrolled === null ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Checking fingerprint status...</p>
              </div>
            ) : (
              /* Enrolled but not checked in — show sensor prompt */
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="relative">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/5">
                    <Fingerprint className="h-14 w-14 text-primary animate-pulse" />
                  </div>
                  <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/20" />
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">Go to the sensor</p>
                  <p className="mt-1 text-sm text-muted-foreground">Place your finger on the sensor to check in.</p>
                </div>
                {fpEnrollments.length > 0 && (
                  <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                    {fpEnrollments.map((e) => (
                      <div key={e.id} className="flex items-center gap-1.5">
                        <Wifi className="h-3 w-3 text-success" />
                        <span className="font-medium">{e.label}</span>
                        {e.location && <span>· {e.location}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/60">Auto-checks every 10 seconds</p>
              </div>
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

      {/* Manual attendance marking — staff, fallback when the fingerprint
          scanner is unavailable. */}
      {role === "staff" && (
        <Card className="space-y-3">
          <SectionHeading
            title="Mark attendance manually"
            description={`Use this when the fingerprint scanner isn't working. Records today's status for your ${people.length} mentee${people.length === 1 ? "" : "s"}.`}
          />
          {markError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{markError}</p>}
          {people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No mentees assigned to you.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="man-filter-sem" className="text-xs font-medium text-muted-foreground">Semester</label>
                  <select
                    id="man-filter-sem"
                    value={manFilterSemester}
                    onChange={(e) => setManFilterSemester(e.target.value)}
                    className={cn(inputCls, "min-w-40")}
                  >
                    <option value="">All semesters</option>
                    {manSemesters.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="relative space-y-1.5">
                  <label htmlFor="man-filter-name" className="text-xs font-medium text-muted-foreground">Student name</label>
                  <input
                    id="man-filter-name"
                    type="search"
                    value={manFilterName}
                    onChange={(e) => setManFilterName(e.target.value)}
                    placeholder="Search mentees…"
                    className={cn(inputCls, "min-w-44")}
                  />
                </div>
                {(manFilterSemester || manFilterName.trim()) && (
                  <button
                    type="button"
                    onClick={() => { setManFilterSemester(""); setManFilterName("") }}
                    className="rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {manFilterSemester || manFilterName.trim()
                  ? `Showing ${manFiltered.length} of ${people.length} mentees.`
                  : `${people.length} mentee${people.length === 1 ? "" : "s"} — filter by semester or name to mark attendance for a specific student.`}
              </p>
              {manFiltered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No mentees match the selected filters.</p>
              ) : (
                <ul className="divide-y divide-border">
              {manFiltered.map((p) => {
                const current = todayStatusMap.get(p.id)
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                    </div>
                    {current && (
                      <span className="pill bg-primary/10 text-primary capitalize">
                        {current === "on-time" ? "present" : current}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleManualMark(p.id, "present")}
                        disabled={markingId === p.id || current === "on-time"}
                        className="rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleManualMark(p.id, "late")}
                        disabled={markingId === p.id || current === "late"}
                        className="rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-warning/40 hover:bg-warning/10 hover:text-warning disabled:opacity-40"
                      >
                        Late
                      </button>
                      <button
                        onClick={() => handleManualMark(p.id, "absent")}
                        disabled={markingId === p.id || current === "absent"}
                        className="rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      >
                        Absent
                      </button>
                    </div>
                  </li>
                )
                })}
                </ul>
              )}
            </>
          )}
        </Card>
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
                    <td className="py-2.5 font-medium">
                      {role !== "student" && r.userId ? (
                        <button
                          onClick={() => selectPerson(r.userId!)}
                          title={`View ${r.name}'s attendance history`}
                          className="rounded-sm text-left underline-offset-2 transition-colors hover:text-primary hover:underline"
                        >
                          {r.name}
                        </button>
                      ) : (
                        r.name
                      )}
                    </td>
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
                ? "Pick a mentee or a date range to inspect their attendance history."
                : "Pick any student or staff member, or filter everyone by date range and role."
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          {role !== "student" && (
            <div className="relative space-y-1.5">
              <label htmlFor="hist-person" className="text-xs font-medium text-muted-foreground">Person</label>
              <input
                id="hist-person"
                type="text"
                value={personId ? (selectedPerson?.name ?? "") : personQuery}
                onChange={(e) => {
                  setPersonId("")
                  setPersonQuery(e.target.value)
                }}
                onFocus={() => setPersonQuery("")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    if (filteredPeople.length === 1) {
                      selectPerson(filteredPeople[0].id)
                    } else if (filteredPeople.length > 0) {
                      selectPerson(filteredPeople[0].id)
                    } else if (personQuery.trim()) {
                      doFetchHistory()
                    }
                  }
                }}
                placeholder={role === "staff" ? "Search mentees…" : "Search people…"}
                className={cn(inputCls, "min-w-44")}
              />
              {(personId || personQuery.trim()) && (
                <button
                  onClick={() => { setPersonId(""); setPersonQuery(""); selectPerson("") }}
                  className="absolute right-2 top-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
              {!personId && personQuery.trim() && filteredPeople.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-sm border border-border bg-card shadow-sm">
                  {filteredPeople.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPersonQuery(""); selectPerson(p.id) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{p.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
          {role === "admin" && !personId && (
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
            onClick={() => doFetchHistory()}
            disabled={historyLoading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden /> {historyLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* History summary */}
        {historySummary && (
          <div className="flex flex-wrap gap-4 rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
            <span className="font-medium">
              {historySummary.total} total record{historySummary.total === 1 ? "" : "s"}
              {selectedPerson ? ` · ${selectedPerson.name}` : ""}
            </span>
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
                  {role !== "student" && <th className="pb-2 font-medium">Name</th>}
                  {role !== "student" && <th className="pb-2 font-medium">Role</th>}
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 font-mono text-muted-foreground">{r.date}</td>
                    {role !== "student" && <td className="py-2.5 font-medium">{r.name}</td>}
                    {role !== "student" && (
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
