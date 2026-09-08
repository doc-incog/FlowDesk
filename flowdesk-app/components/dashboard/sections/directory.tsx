"use client"

import { useEffect, useMemo, useState } from "react"
import { Mail, Pencil, Plus, Search, Trash2, Users } from "lucide-react"
import type { Mentor, Role, UserProfile } from "@/lib/seed-data/core"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

type RoleOption = { key: string; label: string }

const inputCls =
  "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

export function DirectorySection({ kind, role }: { kind: "students" | "staff"; role: Role }) {
  const [data, setData] = useState<UserProfile[] | null>(null)
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [semesterFilter, setSemesterFilter] = useState("")
  const [selected, setSelected] = useState<UserProfile | null>(null)
  const [allStudentsOpen, setAllStudentsOpen] = useState(false)
  const [allStudentsQuery, setAllStudentsQuery] = useState("")
  const [editingAll, setEditingAll] = useState<UserProfile | null>(null)
  const [confirmAllId, setConfirmAllId] = useState<string | null>(null)
  const [deletingAllId, setDeletingAllId] = useState<string | null>(null)
  const [allStudentsError, setAllStudentsError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const isAdmin = role === "admin"

  useEffect(() => {
    let alive = true
    fetch("/api/directory")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) setError(d.error)
        else {
          setData(kind === "students" ? d.students ?? [] : d.staff ?? [])
          setMentors(d.mentors ?? [])
        }
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [kind, tick])

  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        const list = (d?.roles ?? []) as { key: string; label: string }[]
        setRoles(list.map((r) => ({ key: r.key, label: r.label })))
      })
      .catch(() => {
        // role dropdown simply stays empty
      })
    return () => {
      alive = false
    }
  }, [isAdmin])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!data) return []
    let list = data
    if (kind === "students" && semesterFilter) {
      list = list.filter((p) => p.semester === semesterFilter)
    }
    if (!q) return list
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.rollNo?.toLowerCase().includes(q) ?? false),
    )
  }, [data, kind, query, semesterFilter])

  // Students are browsed/grouped by semester, then by class/program (department).
  const studentsFilterData = useMemo(() => {
    if (kind !== "students" || !data) return { semesters: [], groups: [] as { semester: string; class: string; students: UserProfile[] }[] }
    const semesters = Array.from(new Set(data.map((p) => p.semester ?? "").filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const groups: { semester: string; class: string; students: UserProfile[] }[] = []
    for (const semester of semesters) {
      const inSem = filtered.filter((p) => p.semester === semester)
      const classNames = Array.from(new Set(inSem.map((p) => p.department ?? "").filter(Boolean))).sort()
      for (const className of classNames) {
        const students = inSem.filter((p) => p.department === className)
        if (students.length > 0) {
          groups.push({ semester, class: className, students: students.sort((a, b) => a.name.localeCompare(b.name)) })
        }
      }
    }
    return { semesters, groups }
  }, [data, kind, filtered])

  // Admin-only full roster for the "All Students" modal. Always reflects every
  // student on record, independent of the page's search and semester filters.
  const allStudents = useMemo(() => {
    if (kind !== "students" || !data) return []
    const q = allStudentsQuery.trim().toLowerCase()
    const list = q
      ? data.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            (p.rollNo?.toLowerCase().includes(q) ?? false),
        )
      : data
    return list
  }, [data, kind, allStudentsQuery])

  const select = (p: UserProfile | null) => {
    setSelected(p)
    setConfirmingDelete(false)
    setDeleteError(null)
  }

  const deletePerson = async () => {
    if (!selected || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/directory/${selected.id}`, { method: "DELETE" })
      const d = await res.json()
      if (!res.ok) {
        setDeleteError(d?.error ?? "Could not delete this person.")
        return
      }
      select(null)
      setTick((t) => t + 1)
    } catch {
      setDeleteError("Network error while deleting.")
    } finally {
      setDeleting(false)
    }
  }

  // Admin-only delete from the "All Students" modal.
  const deleteAllStudent = async (p: UserProfile) => {
    setDeletingAllId(p.id)
    setAllStudentsError(null)
    try {
      const res = await fetch(`/api/directory/${p.id}`, { method: "DELETE" })
      const d = await res.json()
      if (!res.ok) {
        setAllStudentsError(d?.error ?? "Could not delete this student.")
        return
      }
      if (selected?.id === p.id) select(null)
      setConfirmAllId(null)
      setAllStudentsQuery("")
      setTick((t) => t + 1)
    } catch {
      setAllStudentsError("Network error while deleting.")
    } finally {
      setDeletingAllId(null)
    }
  }

  const title =
    kind === "students"
      ? "Student directory"
      : role === "staff"
        ? "Colleagues"
        : role === "student"
          ? "Mentor directory"
          : "Staff directory"
  const desc = data
    ? kind === "students"
      ? `${data.length} students${role === "staff" ? " you teach or mentor" : " across the campus"}`
      : role === "staff"
        ? `${data.length} colleagues on campus`
        : role === "student"
          ? `${data.length} mentors across the campus`
          : `${data.length} faculty and staff members`
    : ""

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <SectionHeading
        title={title}
        description={desc}
        action={
          isAdmin ? (
            <button
              onClick={() => {
                setAdding(true)
                setEditing(false)
                setSelected(null)
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add {kind === "students" ? "student" : "staff member"}
            </button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder={`Search ${kind} by name or ID…`}
          aria-label="Search people"
          className="w-full rounded-sm border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {kind === "students" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="students-semester" className="text-xs font-medium text-muted-foreground">Semester</label>
            <select
              id="students-semester"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="">All semesters</option>
              {studentsFilterData.semesters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setAllStudentsOpen(true)
                setAllStudentsQuery("")
                setEditingAll(null)
                setConfirmAllId(null)
                setDeletingAllId(null)
                setAllStudentsError(null)
              }}
              className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Users className="h-4 w-4" aria-hidden /> All Students
            </button>
          )}
          {(semesterFilter || query.trim()) && (
            <button
              type="button"
              onClick={() => { setSemesterFilter(""); setQuery("") }}
              className="rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {adding && (
        <PersonForm
          kind={kind}
          roles={roles}
          mentors={mentors}
          onDone={(changed, created) => {
            setAdding(false)
            if (changed) {
              setTick((t) => t + 1)
              if (created) {
                setQuery("")
                if (created.semester) setSemesterFilter(created.semester)
                select(created)
              }
            }
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {kind === "students" && query.trim() ? (
            <>
              <p className="px-1 text-sm text-muted-foreground" role="status">
                {filtered.length === 1 ? "1 result" : `${filtered.length} results`} for “{query.trim()}”
              </p>
              {filtered.length === 0 ? (
                <Card className="py-10 text-center text-sm text-muted-foreground">No students found.</Card>
              ) : (
                filtered.map((p) => <PersonCard key={p.id} p={p} onSelect={select} />)
              )}
            </>
          ) : kind === "students" ? (
            semesterFilter ? (
              studentsFilterData.groups.length === 0 ? (
                <Card className="py-10 text-center text-sm text-muted-foreground">No students found.</Card>
              ) : (
                studentsFilterData.groups.map((g) => (
                  <div key={`${g.semester}|${g.class}`} className="space-y-2 pt-2 first:pt-0">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.semester} · {g.class}
                      <span className="pill bg-secondary text-muted-foreground">{g.students.length}</span>
                    </p>
                    <div className="space-y-3">
                      {g.students.map((p) => <PersonCard key={p.id} p={p} onSelect={select} />)}
                    </div>
                  </div>
                ))
              )
            ) : (
              <Card className="py-10 text-center text-sm text-muted-foreground">
                Search for a student or select a semester/class to view student details.
              </Card>
            )
          ) : filtered.length === 0 ? (
            <Card className="py-10 text-center text-sm text-muted-foreground">
              {role === "student" ? "No mentors found." : "No staff members found."}
            </Card>
          ) : (
            filtered.map((p) => <PersonCard key={p.id} p={p} onSelect={select} />)
          )}
        </div>

        {/* Detail panel */}
        <Card className="h-fit lg:sticky lg:top-24">
          {selected ? (
            <div className="space-y-4">
              {editing ? (
                <PersonForm
                  kind={kind}
                  roles={roles}
                  person={selected}
                  mentors={mentors}
                  onDone={(changed) => {
                    setEditing(false)
                    if (changed) setTick((t) => t + 1)
                  }}
                />
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Avatar initials={selected.avatarInitials} className="h-16 w-16 text-lg" />
                    <div>
                      <p className="text-lg font-bold">{selected.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(role === "student" && (selected.roleLabel ?? selected.role) === "staff" ? "Mentors" : (selected.roleLabel ?? selected.role))} · {kind === "students" ? selected.semester : selected.designation}
                      </p>
                    </div>
                  </div>
                  <dl className="space-y-2.5 border-t border-border pt-4 text-sm">
                    <Row label="ID" value={selected.id} mono />
                    {kind === "students" && <Row label="Roll No" value={selected.rollNo ?? "—"} mono />}
                    <Row label="Department" value={selected.department} />
                    {kind === "students" ? (
                      <Row label="Mentor" value={mentors.find((m) => m.id === selected.mentorId)?.name ?? "—"} />
                    ) : (
                      <Row label="Subjects" value={selected.subjects?.join(", ") ?? "—"} />
                    )}
                    <Row label="Email" value={selected.email} />
                    <Row label="Phone" value={selected.phone ?? "—"} />
                    <Row label="Address" value={selected.address ?? "—"} />
                    {kind === "students" && <Row label="Guardian" value={selected.guardianName ?? "—"} />}
                    {kind === "students" && <Row label="Guardian phone" value={selected.guardianPhone ?? "—"} />}
                    <Row label="Emergency contact" value={selected.emergencyContact ?? "—"} />
                  </dl>
                  <div className="flex gap-2">
                    <a
                      href={`mailto:${selected.email}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Mail className="h-4 w-4" aria-hidden /> Contact
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => setEditing(true)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
                      >
                        <Pencil className="h-4 w-4" aria-hidden /> Edit
                      </button>
                    )}
                  </div>
                  {isAdmin && !editing && (
                    confirmingDelete ? (
                      <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                        <p className="text-sm">
                          Are you sure you want to delete <b>{selected.name}</b>?
                        </p>
                        {deleteError && (
                          <p role="alert" className="text-sm text-destructive">{deleteError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={deletePerson}
                            disabled={deleting}
                            className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden /> {deleting ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(false)}
                            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-sm border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden /> Delete account
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Search className="h-6 w-6" aria-hidden />
              Select a {kind === "students" ? "student" : role === "student" ? "mentor" : "staff member"} to view details.
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={allStudentsOpen}
        onClose={() => {
          setAllStudentsOpen(false)
          setEditingAll(null)
          setConfirmAllId(null)
          setAllStudentsError(null)
        }}
        title={editingAll ? `Edit ${editingAll.name}` : `All Students · ${data.length}`}
        className="max-w-3xl"
      >
        {editingAll ? (
          <PersonForm
            kind="students"
            roles={roles}
            mentors={mentors}
            person={editingAll}
            onDone={(changed) => {
              setEditingAll(null)
              if (changed) setTick((t) => t + 1)
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={allStudentsQuery}
                onChange={(e) => setAllStudentsQuery(e.target.value)}
                type="search"
                placeholder="Search by name, ID or roll no…"
                aria-label="Search all students"
                className="w-full rounded-sm border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {allStudentsError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {allStudentsError}
              </p>
            )}
            {allStudents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No students found.</p>
            ) : (
              <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {allStudents.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center gap-3 rounded-md border border-border/70 p-3">
                      <Avatar initials={p.avatarInitials} className="h-10 w-10 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {p.rollNo ?? "—"} · {p.semester ?? "—"} · {p.department}
                        </p>
                      </div>
                      <div className="hidden shrink-0 space-y-0.5 text-right text-xs text-muted-foreground sm:block">
                        <p><span className="font-mono">{p.id}</span></p>
                        <p>Batch {p.batch ?? "—"} · Mentor {mentors.find((m) => m.id === p.mentorId)?.name ?? "—"}</p>
                      </div>
                      {confirmAllId === p.id ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted-foreground">Delete {p.name}?</span>
                          <button
                            type="button"
                            onClick={() => deleteAllStudent(p)}
                            disabled={deletingAllId === p.id}
                            className="flex items-center gap-1 rounded-sm bg-destructive px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden /> {deletingAllId === p.id ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAllId(null)}
                            disabled={deletingAllId === p.id}
                            className="rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingAll(p)}
                            aria-label={`Edit ${p.name}`}
                            title="Edit student details"
                            className="flex shrink-0 items-center justify-center rounded-sm border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmAllId(p.id)
                              setAllStudentsError(null)
                            }}
                            aria-label={`Delete ${p.name}`}
                            title="Delete student"
                            className="flex shrink-0 items-center justify-center rounded-sm border border-border p-2 text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function PersonCard({ p, onSelect }: { p: UserProfile; onSelect: (p: UserProfile) => void }) {
  return (
    <Card>
      <button onClick={() => onSelect(p)} className="flex w-full items-center gap-4 text-left">
        <Avatar initials={p.avatarInitials} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {p.rollNo ? `${p.rollNo} · ${p.semester ?? ""} · ${p.department}` : `${p.designation ?? ""} · ${p.department}`}
          </p>
        </div>
        <span className="hidden shrink-0 pill bg-secondary text-muted-foreground sm:block">
          {p.id}
        </span>
      </button>
    </Card>
  )
}

function PersonForm({
  kind,
  roles,
  person,
  mentors,
  onDone,
}: {
  kind: "students" | "staff"
  roles: RoleOption[]
  person?: UserProfile
  mentors: Mentor[]
  onDone: (changed: boolean, created?: UserProfile) => void
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    name: person?.name ?? "",
    email: person?.email ?? "",
    department: person?.department ?? "",
    role: person?.role ?? (kind === "staff" ? "staff" : "student"),
    phone: person?.phone ?? "",
    address: person?.address ?? "",
    guardianName: person?.guardianName ?? "",
    guardianPhone: person?.guardianPhone ?? "",
    emergencyContact: person?.emergencyContact ?? "",
    dob: person?.dob ?? "",
    rollNo: person?.rollNo ?? "",
    semester: person?.semester ?? "",
    batch: person?.batch ?? "",
    mentorId: person?.mentorId ?? "",
    designation: person?.designation ?? "",
    subjects: person?.subjects?.join(", ") ?? "",
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        kind,
        ...form,
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      }
      const res = await fetch(person ? `/api/directory/${person.id}` : "/api/directory", {
        method: person ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Could not save this person.")
        return
      }
      onDone(true, person ? undefined : (data?.person as UserProfile | undefined))
    } catch {
      setError("Network error while saving this person.")
    } finally {
      setSaving(false)
    }
  }

  const isStudent = form.role === "student"

  return (
    <Card className="border-primary/30">
      <p className="mb-4 font-bold">{person ? `Edit ${person.name}` : `Add ${kind === "students" ? "student" : "staff member"}`}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputCls} value={form.name} onChange={(e) => set("name")(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email")(e.target.value)} />
        </Field>
        <Field label="Role">
          {person ? (
            <select className={inputCls} value={form.role} onChange={(e) => set("role")(e.target.value)}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          ) : (
            <div className="flex h-10 items-center rounded-sm border border-input bg-secondary/50 px-3 text-sm">
              {kind === "staff" ? "Staff" : "Student"}
            </div>
          )}
        </Field>
        <Field label="Department">
          <input className={inputCls} value={form.department} onChange={(e) => set("department")(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
        </Field>
        <Field label="Emergency contact">
          <input className={inputCls} value={form.emergencyContact} onChange={(e) => set("emergencyContact")(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <input className={inputCls} value={form.address} onChange={(e) => set("address")(e.target.value)} />
          </Field>
        </div>

        {isStudent ? (
          <>
            <Field label="Roll no">
              <input className={inputCls} value={form.rollNo} onChange={(e) => set("rollNo")(e.target.value)} />
            </Field>
            <Field label="Semester">
              <input className={inputCls} value={form.semester} onChange={(e) => set("semester")(e.target.value)} />
            </Field>
            <Field label="Batch">
              <input className={inputCls} value={form.batch} onChange={(e) => set("batch")(e.target.value)} />
            </Field>
            <Field label="Mentor">
              <select
                className={cn(inputCls, "bg-card")}
                value={form.mentorId}
                onChange={(e) => set("mentorId")(e.target.value)}
              >
                <option value="">— No mentor —</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Guardian name">
              <input className={inputCls} value={form.guardianName} onChange={(e) => set("guardianName")(e.target.value)} />
            </Field>
            <Field label="Guardian phone">
              <input className={inputCls} value={form.guardianPhone} onChange={(e) => set("guardianPhone")(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Designation">
              <input className={inputCls} value={form.designation} onChange={(e) => set("designation")(e.target.value)} />
            </Field>
            <Field label="Subjects (comma separated)">
              <input className={inputCls} value={form.subjects} onChange={(e) => set("subjects")(e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {!person && (
        <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          New accounts can sign in with their email and the default password <b>campus123</b>.
        </p>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving || !form.name.trim() || !form.email.trim()}
          className={cn(
            "rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity",
            saving ? "opacity-50" : "hover:opacity-90",
          )}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => onDone(false)}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
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
