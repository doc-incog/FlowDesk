"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Save, Search, ShieldCheck, Trash2 } from "lucide-react"
import type { UserProfile } from "@/lib/seed-data/core"
import { SECTION_KEYS } from "@/lib/constants"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type RoleInfo = {
  key: string
  label: string
  blurb: string
  accent: string
  builtin: boolean
  sections: string[]
  users: number
}

const inputCls =
  "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

export function RolesSection() {
  const [tab, setTab] = useState("roles")
  const [roles, setRoles] = useState<RoleInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) setError(d.error)
        else setRoles(d.roles ?? [])
      })
      .catch(() => alive && setError("Failed to load roles"))
    return () => {
      alive = false
    }
  }, [tick])

  const tabs: TabItem[] = [
    { id: "roles", label: "Roles" },
    { id: "overrides", label: "Per-user overrides" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Roles & permissions"
        description="Define roles and control which dashboard sections each role — or individual person — can see."
      />

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <SectionTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "roles" && (
        <RolesTab roles={roles} reload={reload} />
      )}

      {tab === "overrides" && <OverridesTab />}
    </div>
  )
}

function RolesTab({ roles, reload }: { roles: RoleInfo[] | null; reload: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  if (!roles) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add role
        </button>
      )}

      {adding && (
        <RoleForm
          title="New role"
          onDone={(created) => {
            setAdding(false)
            if (created) reload()
          }}
        />
      )}

      {roles.map((r) => (
        <Card key={r.key}>
          {editing === r.key ? (
            <RoleForm
              title={`Edit ${r.label}`}
              initial={r}
              onDone={(updated) => {
                setEditing(null)
                if (updated) reload()
              }}
            />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{r.label}</p>
                  <span className="font-mono text-xs text-muted-foreground">{r.key}</span>
                  {r.builtin && <span className="pill bg-secondary text-muted-foreground">built-in</span>}
                  <span className="pill bg-secondary text-muted-foreground">{r.users} people</span>
                </div>
                {r.blurb && <p className="mt-1 text-sm text-muted-foreground">{r.blurb}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.sections.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No sections — nothing visible.</span>
                  ) : (
                    r.sections.map((s) => (
                      <span key={s} className="pill bg-primary/10 text-primary">{s}</span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={() => setEditing(r.key)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  Edit
                </button>
                {!r.builtin && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete the "${r.label}" role?`)) return
                      const res = await fetch(`/api/roles/${r.key}`, { method: "DELETE" })
                      const data = await res.json()
                      if (!res.ok) {
                        alert(data?.error ?? "Could not delete role")
                        return
                      }
                      reload()
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    aria-label={`Delete ${r.label}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function RoleForm({
  title,
  initial,
  onDone,
}: {
  title: string
  initial?: RoleInfo
  onDone: (changed: boolean) => void
}) {
  const [key, setKey] = useState(initial?.key ?? "")
  const [label, setLabel] = useState(initial?.label ?? "")
  const [blurb, setBlurb] = useState(initial?.blurb ?? "")
  const accent = initial?.accent ?? "chart-5"
  const [sections, setSections] = useState<Set<string>>(new Set(initial?.sections ?? []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (s: string) => {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        label,
        blurb,
        accent,
        sections: [...sections],
      }
      if (!initial) {
        body.key = key
      } else if (key !== initial.key) {
        body.newKey = key
      }
      const res = await fetch(initial ? `/api/roles/${initial.key}` : "/api/roles", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Could not save the role.")
        return
      }
      onDone(true)
    } catch {
      setError("Network error while saving the role.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-bold">{title}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Role key{initial ? " (rename)" : ""}</label>
          <input
            className={inputCls}
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder="librarian"
            disabled={!!initial && initial.builtin}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Display label</label>
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Librarian" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium">Blurb</label>
          <input className={inputCls} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Short description shown with the role." />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Visible sections</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SECTION_KEYS.map((s) => (
            <label
              key={s}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                sections.has(s)
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card/50 hover:bg-secondary/50",
              )}
            >
              <input
                type="checkbox"
                checked={sections.has(s)}
                onChange={() => toggle(s)}
                className="accent-(--primary)"
              />
              <span className="capitalize">{s}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !label.trim() || (!initial && !key.trim())}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden /> {saving ? "Saving…" : "Save role"}
        </button>
        <button
          onClick={() => onDone(false)}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function OverridesTab() {
  const [people, setPeople] = useState<UserProfile[] | null>(null)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [permState, setPermState] = useState<{ userId: string; defaults: string[]; override: string[] | null } | null>(null)
  const [custom, setCustom] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/directory")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        const students = (d?.students ?? []) as UserProfile[]
        const staff = (d?.staff ?? []) as UserProfile[]
        setPeople([...students, ...staff])
      })
      .catch(() => alive && setError("Failed to load people"))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let alive = true
    fetch(`/api/permissions?userId=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) {
          setError(d.error)
          return
        }
        setPermState({ userId: selectedId, defaults: d.defaults ?? [], override: d.override ?? null })
        setCustom(new Set(d.override ?? d.defaults ?? []))
        setSaved(false)
      })
      .catch(() => alive && setError("Failed to load permissions"))
    return () => {
      alive = false
    }
  }, [selectedId])

  const perms = permState?.userId === selectedId ? permState : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!people) return []
    if (!q) return people
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [people, query])

  const save = async () => {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedId, sections: perms?.override === null ? null : [...custom] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Could not save permissions.")
        return
      }
      setPermState((prev) => ({ userId: selectedId, defaults: prev?.defaults ?? [], override: data.override ?? null }))
      setSaved(true)
    } catch {
      setError("Network error while saving permissions.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault()
                setSelectedId(filtered[0].id)
              }
            }}
            placeholder="Search people…"
            aria-label="Search people"
            className="w-full rounded-sm border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matches.</p>}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                selectedId === p.id ? "border-primary/40 bg-primary/10" : "border-border bg-card/50 hover:bg-secondary/50",
              )}
            >
              <Avatar initials={p.avatarInitials} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{p.id} · {p.role}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        {!perms ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Select a person to edit their visibility.</p>
        ) : (
          <div className="space-y-4">
            <p className="font-bold">Section visibility</p>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm">
              <span>Use role defaults</span>
              <button
                role="switch"
                aria-checked={perms.override === null}
                onClick={() => {
                  const useDefaults = perms.override !== null
                  setPermState({ userId: perms.userId, defaults: perms.defaults, override: useDefaults ? null : [...perms.defaults] })
                  setCustom(new Set(perms.defaults))
                }}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  perms.override === null ? "bg-primary" : "bg-input",
                )}
                aria-label="Use role defaults"
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                    perms.override === null ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>

            {perms.override === null ? (
              <div className="flex flex-wrap gap-1.5">
                {perms.defaults.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No sections for this role.</span>
                ) : (
                  perms.defaults.map((s) => <span key={s} className="pill bg-primary/10 text-primary">{s}</span>)
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SECTION_KEYS.map((s) => (
                  <label
                    key={s}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors",
                      custom.has(s) ? "border-primary/40 bg-primary/10" : "border-border bg-card/50",
                    )}
                  >
                    <input type="checkbox" checked={custom.has(s)} onChange={() => {
                      setCustom((prev) => {
                        const next = new Set(prev)
                        if (next.has(s)) next.delete(s)
                        else next.add(s)
                        return next
                      })
                    }} className="accent-(--primary)" />
                    <span className="capitalize">{s}</span>
                  </label>
                ))}
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-success">Permissions saved.</p>}

            <button
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden /> {saving ? "Saving…" : "Save permissions"}
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
