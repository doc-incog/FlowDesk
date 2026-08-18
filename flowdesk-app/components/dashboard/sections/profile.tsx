"use client"

import { useState } from "react"
import { Save, Lock } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"

function profileCompleteness(user: Record<string, unknown>): { pct: number; missing: string[] } {
  const fields: [string, string][] = [
    ["name", "Name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["address", "Address"],
    ["dob", "Date of birth"],
    ["department", "Department"],
  ]
  if (user.role === "student") {
    fields.push(["rollNo", "Roll no"], ["semester", "Semester"], ["batch", "Batch"])
  } else {
    fields.push(["designation", "Designation"])
  }
  const filled = fields.filter(([k]) => {
    const v = user[k]
    return v !== null && v !== undefined && String(v).trim() !== ""
  })
  const missing = fields.filter(([k]) => {
    const v = user[k]
    return v === null || v === undefined || String(v).trim() === ""
  }).map(([, label]) => label)
  return { pct: Math.round((filled.length / fields.length) * 100), missing }
}

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
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  if (!user) return <p className="text-sm text-muted-foreground">Loading…</p>

  const isStudent = user.role === "student"
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  const { pct, missing } = profileCompleteness({ ...form, role: user.role })

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

  const changePassword = async () => {
    setPwSaving(true)
    setPwMsg(null)
    setPwError(null)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwError(data?.error ?? "Failed to change password")
      } else {
        setPwMsg("Password changed successfully.")
        setPwCurrent("")
        setPwNew("")
      }
    } catch {
      setPwError("Network error while changing password.")
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Profile" description="Your personal details, contact info and role-specific fields." />

      {/* Profile completeness */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Profile completeness</p>
          <span className="text-sm font-bold text-primary">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Missing: {missing.join(", ")}
          </p>
        )}
      </Card>

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

      {/* Password change */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">Change password</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <input
              type="password"
              className={inputCls}
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              placeholder="Enter current password"
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              className={inputCls}
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              placeholder="At least 6 characters"
            />
          </Field>
        </div>
        {pwError && <p role="alert" className="mt-3 text-sm text-destructive">{pwError}</p>}
        {pwMsg && <p className="mt-3 text-sm text-success">{pwMsg}</p>}
        <button
          onClick={changePassword}
          disabled={pwSaving || !pwCurrent || !pwNew}
          className="mt-4 flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <Lock className="h-4 w-4" aria-hidden /> {pwSaving ? "Changing…" : "Change password"}
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
