"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Search, UserPlus, UserX, Users } from "lucide-react"
import type { UserProfile } from "@/lib/seed-data/core"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

type Student = UserProfile

type MentorWithStudents = {
  id: string
  name: string
  designation: string
  department: string
  avatarInitials: string
  students: Student[]
}

export function MenteesSection() {
  const [mentors, setMentors] = useState<MentorWithStudents[]>([])
  const [unassigned, setUnassigned] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assignQuery, setAssignQuery] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/mentees")
      const d = await res.json()
      if (d?.error) {
        setError(d.error)
        return
      }
      setMentors(d.mentors ?? [])
      setUnassigned(d.unassigned ?? [])
      setSelectedId((prev) => (d.mentors ?? []).some((m: { id: string }) => m.id === prev) ? prev : (d.mentors?.[0]?.id ?? null))
    } catch {
      setError("Failed to load mentees.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = mentors.find((m) => m.id === selectedId) ?? null

  const assignable = useMemo(() => {
    const q = assignQuery.trim().toLowerCase()
    return unassigned.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || s.rollNo?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    )
  }, [unassigned, assignQuery])

  const assign = async (studentId: string) => {
    if (!selected || assigning) return
    setAssigning(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/directory/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId: selected.id }),
      })
      const d = await res.json()
      if (!res.ok) {
        setMsg(d?.error ?? "Could not assign.")
        return
      }
      await load()
    } catch {
      setMsg("Network error while assigning.")
    } finally {
      setAssigning(false)
    }
  }

  const remove = async (studentId: string) => {
    setBusyId(studentId)
    setMsg(null)
    try {
      const res = await fetch(`/api/directory/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId: "" }),
      })
      const d = await res.json()
      if (!res.ok) {
        setMsg(d?.error ?? "Could not remove.")
        return
      }
      await load()
    } catch {
      setMsg("Network error while removing.")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Mentee assignments"
        description="Assign and remove student mentees for each staff mentor on the roster."
      />

      {msg && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: mentor roster picker + their mentees */}
        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="text-sm font-semibold">Staff mentors</p>
            {mentors.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No mentors on the roster.</p>
            )}
            <div className="space-y-1.5">
              {mentors.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  aria-current={selectedId === m.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    selectedId === m.id ? "border-primary/40 bg-primary/10" : "border-border bg-card/50 hover:bg-secondary/50",
                  )}
                >
                  <Avatar initials={m.avatarInitials} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.designation} · {m.department}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden /> {m.students.length}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {selected && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Mentees of {selected.name}</p>
                <span className="pill bg-muted text-muted-foreground">{selected.students.length}</span>
              </div>
              {selected.students.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No mentees assigned yet.</p>
              )}
              <ul className="divide-y divide-border">
                {selected.students.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <Avatar initials={s.avatarInitials} className="h-9 w-9 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{s.rollNo ?? s.id}</p>
                    </div>
                    <button
                      onClick={() => remove(s.id)}
                      disabled={busyId === s.id}
                      className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-40"
                    >
                      <UserX className="h-3.5 w-3.5" aria-hidden /> {busyId === s.id ? "Removing…" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right: assign an unassigned student */}
        <Card className="h-fit space-y-3">
          <p className="text-sm font-semibold">
            Assign a student to {selected?.name ?? "a mentor"}
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={assignQuery}
              onChange={(e) => setAssignQuery(e.target.value)}
              placeholder="Search unassigned students…"
              aria-label="Search unassigned students"
              className="w-full rounded-sm border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {!selected && <p className="py-6 text-center text-sm text-muted-foreground">Pick a mentor first.</p>}
          {selected && assignable.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {unassigned.length === 0 ? "All students are assigned to a mentor." : "No students match your search."}
            </p>
          )}
          {selected && assignable.length > 0 && (
            <ul className="divide-y divide-border">
              {assignable.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <Avatar initials={s.avatarInitials} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{s.rollNo ?? s.id}</p>
                  </div>
                  <button
                    onClick={() => assign(s.id)}
                    disabled={assigning}
                    className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                  >
                    {assigning ? <Check className="h-3.5 w-3.5" aria-hidden /> : <UserPlus className="h-3.5 w-3.5" aria-hidden />}
                    Assign
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
