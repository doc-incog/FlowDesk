"use client"

import { useMemo, useState } from "react"
import { Mail, Search } from "lucide-react"
import { MENTORS, STAFF, STUDENTS, type Role, type UserProfile } from "@/lib/mock-data"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"

function mentorName(mentorId?: string) {
  return MENTORS.find((m) => m.id === mentorId)?.name ?? "—"
}

export function DirectorySection({ kind, role }: { kind: "students" | "staff"; role: Role }) {
  const data = kind === "students" ? STUDENTS : STAFF
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<UserProfile | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.rollNo?.toLowerCase().includes(q) ?? false),
    )
  }, [data, query])

  const title = kind === "students" ? "Student directory" : "Staff directory"
  const desc =
    kind === "students"
      ? `${data.length} students${role === "staff" ? " you teach or mentor" : " across the campus"}`
      : `${data.length} faculty and staff members`

  return (
    <div className="space-y-6">
      <SectionHeading title={title} description={desc} />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder={`Search ${kind}…`}
          className="w-full rounded-lg border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {filtered.map((p) => (
            <Card key={p.id}>
              <button onClick={() => setSelected(p)} className="flex w-full items-center gap-4 text-left">
                <Avatar initials={p.avatarInitials} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {kind === "students"
                      ? `${p.rollNo} · ${p.semester}`
                      : `${p.designation} · ${p.department}`}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-lg bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground sm:block">
                  {p.id}
                </span>
              </button>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="py-10 text-center text-sm text-muted-foreground">No matches found.</Card>
          )}
        </div>

        {/* Detail panel */}
        <Card className="h-fit lg:sticky lg:top-24">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar initials={selected.avatarInitials} className="h-16 w-16 text-lg" />
                <div>
                  <p className="text-lg font-bold">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {kind === "students" ? selected.semester : selected.designation}
                  </p>
                </div>
              </div>
              <dl className="space-y-2.5 border-t border-border pt-4 text-sm">
                <Row label="ID" value={selected.id} mono />
                {kind === "students" && <Row label="Roll No" value={selected.rollNo ?? "—"} mono />}
                <Row label="Department" value={selected.department} />
                {kind === "students" ? (
                  <Row label="Mentor" value={mentorName(selected.mentorId)} />
                ) : (
                  <Row label="Subjects" value={selected.subjects?.join(", ") ?? "—"} />
                )}
                <Row label="Email" value={selected.email} />
              </dl>
              <a
                href={`mailto:${selected.email}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Mail className="h-4 w-4" aria-hidden /> Contact
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Search className="h-6 w-6" aria-hidden />
              Select a {kind === "students" ? "student" : "staff member"} to view details.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  )
}
