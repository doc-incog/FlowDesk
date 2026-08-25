"use client"

import { useEffect, useMemo, useState } from "react"
import { Mail, Pencil, Plus, Search, Trash2 } from "lucide-react"
import type { Mentor, Role, UserProfile } from "@/lib/seed-data/core"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"
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
  const [selected, setSelected] = useState<UserProfile | null>(null)
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
    if (!q) return data
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.rollNo?.toLowerCase().includes(q) ?? false),
    )
  }, [data, query])

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

  const title = kind === "students" ? "Student directory" : "Staff directory"
  const desc = data
    ? kind === "students"
      ? `${data.length} students${role === "staff" ? " you teach or mentor" : " across the campus"}`
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
          placeholder={`Search ${kind}…`}
          aria-label="Search people"
          className="w-full rounded-sm border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {adding && (
        <PersonForm
          kind={kind}
          roles={roles}
          onDone={(changed) => {
            setAdding(false)
            if (changed) setTick((t) => t + 1)
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {filtered.map((p) => (
            <Card key={p.id}>
              <button onClick={() => select(p)} className="flex w-full items-center gap-4 text-left">
                <Avatar initials={p.avatarInitials} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {kind === "students"
                      ? `${p.rollNo ?? ""} · ${p.semester ?? ""}`
                      : `${p.designation ?? ""} · ${p.department}`}
                  </p>
                </div>
                <span className="hidden shrink-0 pill bg-secondary text-muted-foreground sm:block">
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
              {editing ? (
                <PersonForm
                  kind={kind}
                  roles={roles}
                  person={selected}
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
                        {selected.roleLabel ?? selected.role} · {kind === "students" ? selected.semester : selected.designation}
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
                          Delete <b>{selected.name}</b>? This removes their account, attendance and chat
                          history. Fees already paid and results are kept.
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
              Select a {kind === "students" ? "student" : "staff member"} to view details.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function PersonForm({
  kind,
  roles,
  person,
  onDone,
}: {
  kind: "students" | "staff"
  roles: RoleOption[]
  person?: UserProfile
  onDone: (changed: boolean) => void
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
      onDone(true)
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
          <select className={inputCls} value={form.role} onChange={(e) => set("role")(e.target.value)}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
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
            <Field label="Mentor ID">
              <input className={inputCls} value={form.mentorId} onChange={(e) => set("mentorId")(e.target.value)} />
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
