"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"

export function ProfileSection() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState<Record<string, string>>(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatarInitials: user?.avatarInitials ?? "",
    department: user?.department ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    dob: user?.dob ?? "",
    rollNo: user?.rollNo ?? "",
    semester: user?.semester ?? "",
    batch: user?.batch ?? "",
    mentorId: user?.mentorId ?? "",
    designation: user?.designation ?? "",
  }))
  const [subjects, setSubjects] = useState(() => user?.subjects?.join(", ") ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return <p className="text-sm text-muted-foreground">Loading…</p>

  const isStudent = user.role === "student"
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Could not save your profile.")
        return
      }
      await refreshUser()
      setSaved(true)
    } catch {
      setError("Network error while saving your profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Profile" description="Your personal details, contact info and role-specific fields." />

      <Card>
        <div className="mb-5 flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
          <Avatar initials={form.avatarInitials || user.avatarInitials} className="h-14 w-14 text-lg" />
          <div>
            <p className="font-bold">{form.name || user.name}</p>
            <p className="text-sm text-muted-foreground">
              {user.roleLabel ?? user.role} · {user.id}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputCls} value={form.name ?? ""} onChange={(e) => set("name")(e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email ?? ""} onChange={(e) => set("email")(e.target.value)} />
          </Field>
          <Field label="Avatar initials">
            <input className={inputCls} maxLength={3} value={form.avatarInitials ?? ""} onChange={(e) => set("avatarInitials")(e.target.value)} />
          </Field>
          <Field label="Department">
            <input className={inputCls} value={form.department ?? ""} onChange={(e) => set("department")(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone ?? ""} onChange={(e) => set("phone")(e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <input type="date" className={inputCls} value={form.dob ?? ""} onChange={(e) => set("dob")(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <input className={inputCls} value={form.address ?? ""} onChange={(e) => set("address")(e.target.value)} />
            </Field>
          </div>

          {isStudent ? (
            <>
              <Field label="Roll no">
                <input className={inputCls} value={form.rollNo ?? ""} onChange={(e) => set("rollNo")(e.target.value)} />
              </Field>
              <Field label="Semester">
                <input className={inputCls} value={form.semester ?? ""} onChange={(e) => set("semester")(e.target.value)} />
              </Field>
              <Field label="Batch">
                <input className={inputCls} value={form.batch ?? ""} onChange={(e) => set("batch")(e.target.value)} />
              </Field>
              <Field label="Mentor ID">
                <input className={inputCls} value={form.mentorId ?? ""} onChange={(e) => set("mentorId")(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Designation">
                <input className={inputCls} value={form.designation ?? ""} onChange={(e) => set("designation")(e.target.value)} />
              </Field>
              <Field label="Subjects (comma separated)">
                <input className={inputCls} value={subjects} onChange={(e) => setSubjects(e.target.value)} />
              </Field>
            </>
          )}
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {saved && <p className="mt-4 text-sm text-success">Profile saved.</p>}

        <button
          onClick={save}
          disabled={saving}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          <Save className="h-4 w-4" aria-hidden /> {saving ? "Saving…" : "Save changes"}
        </button>
      </Card>
    </div>
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
