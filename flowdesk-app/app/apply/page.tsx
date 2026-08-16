"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2, CheckCircle2, FileText, GraduationCap, Search } from "lucide-react"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { MockFileUpload } from "@/components/ui/mock-upload"
import { cn } from "@/lib/utils"

type Program = {
  id: string
  name: string
  duration: string
  seats: number
  deadline: string
  fee: number
}

type AdmissionStatus = "submitted" | "reviewing" | "accepted" | "rejected"

type AdmissionApplication = {
  id: string
  applicantName: string
  email: string
  programId: string
  programName: string
  score: number
  docs: string[]
  status: AdmissionStatus
  submittedAt: string
  notes: string
}

const formatSubmittedAt = (value: string) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
}

const STATUS_PILL: Record<AdmissionStatus, string> = {
  submitted: "bg-primary/10 text-primary",
  reviewing: "bg-warning/15 text-warning",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
}

const STATUS_LABEL: Record<AdmissionStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  accepted: "Accepted",
  rejected: "Rejected",
}

type View = "apply" | "track"

export default function ApplyPage() {
  const [applications, setApplications] = useState<AdmissionApplication[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [programsError, setProgramsError] = useState("")
  const [view, setView] = useState<View>("apply")

  const [form, setForm] = useState({
    name: "",
    email: "",
    programId: "",
    score: 80,
    docs: [] as string[],
  })
  const [error, setError] = useState("")
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [trackId, setTrackId] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/programs")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load programmes"))))
      .then((data) => {
        if (!cancelled) setPrograms(Array.isArray(data.programs) ? data.programs : [])
      })
      .catch(() => {
        if (!cancelled) setProgramsError("Could not load programmes. Please refresh.")
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.programId) {
      setError("Name, email and programme are required.")
      return
    }
    setError("")
    try {
      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: form.name.trim(),
          email: form.email.trim(),
          programId: form.programId,
          score: Number(form.score) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }
      const app = data.application as AdmissionApplication
      setApplications((prev) => [app, ...prev])
      setSubmittedId(app.id)
    } catch {
      setError("Network error — please try again.")
    }
  }

  const trackApp = trackId.trim()
    ? applications.find((a) => a.id.toLowerCase() === trackId.trim().toLowerCase())
    : undefined

  const inputCls =
    "w-full rounded-lg border border-input bg-card/70 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"

  const labelCls = "text-sm font-medium"

  return (
    <main className="ambient min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
          </Link>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" aria-hidden />
            </div>
            <span className="text-base font-semibold tracking-tight">FlowDesk Admissions</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">Admissions 2026</h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted-foreground">
            Apply online to our undergraduate and postgraduate programmes. Track your application status anytime using
            the application ID you receive.
          </p>
          <div className="mt-7 inline-flex rounded-lg border border-border bg-secondary/60 p-1 text-sm">
            <button
              onClick={() => setView("apply")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 transition-colors",
                view === "apply" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GraduationCap className="h-4 w-4" aria-hidden /> Apply
            </button>
            <button
              onClick={() => setView("track")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 transition-colors",
                view === "track" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Search className="h-4 w-4" aria-hidden /> Track status
            </button>
          </div>
        </div>

        {view === "apply" ? (
          submittedId ? (
            <Card className="mx-auto max-w-lg py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/50 bg-success/10 text-success">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </span>
              <p className="mt-5 text-xl font-semibold">Application submitted</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your application ID is{" "}
                <span className="font-mono font-semibold text-primary">{submittedId}</span>. Save it to track your
                status.
              </p>
              <button
                onClick={() => {
                  setView("track")
                  setTrackId(submittedId)
                }}
                className="mt-7 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.99]"
              >
                Track status
              </button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <SectionHeading title="Programmes" description="2026 intake options." />
                <div className="space-y-2">
                  {programsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading programmes…</p>
                  ) : programsError ? (
                    <p className="text-sm text-destructive">{programsError}</p>
                  ) : programs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No programmes available.</p>
                  ) : null}
                  {programs.map((p) => {
                    const selected = form.programId === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => setForm((f) => ({ ...f, programId: p.id }))}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                          selected ? "border-primary bg-primary/5" : "border-border bg-secondary/40 hover:bg-secondary",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{p.name}</p>
                          {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.duration} · {p.seats} seats · {p.fee.toLocaleString("en-IN")}/yr
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-primary">Deadline {p.deadline}</p>
                      </button>
                    )
                  })}
                </div>
              </Card>

              <Card className="lg:col-span-3">
                <SectionHeading title="Application form" />
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Full name</label>
                      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Rohan Verma" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Entrance / qualifying score</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.score}
                      onChange={(e) => setForm((f) => ({ ...f, score: Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Documents</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <MockFileUpload
                        label="Attach marksheet"
                        onSelect={(file) => file && setForm((f) => ({ ...f, docs: [...f.docs, file.name] }))}
                      />
                      <MockFileUpload
                        label="Attach ID proof (optional)"
                        onSelect={(file) => file && setForm((f) => ({ ...f, docs: [...f.docs, file.name] }))}
                      />
                    </div>
                    {form.docs.length > 0 && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" aria-hidden /> {form.docs.length} document(s) attached
                      </p>
                    )}
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <button
                    onClick={submit}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.99]"
                  >
                    <GraduationCap className="h-4 w-4" aria-hidden /> Submit application
                  </button>
                  <p className="text-center text-xs text-muted-foreground">
                    Your application is stored in the campus database and visible to the admin Admissions queue.
                  </p>
                </div>
              </Card>
            </div>
          )
        ) : (
          <Card className="mx-auto max-w-lg">
            <SectionHeading title="Track your application" description="Enter the application ID you received at submission." />
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelCls}>Application ID</label>
                <input
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  placeholder="e.g. aa-1782500000000-abc123"
                  className={inputCls}
                />
              </div>
              {trackApp ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-secondary/50 px-4 py-3">
                    <p className="font-semibold">{trackApp.applicantName}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {trackApp.id} · {trackApp.programName} · Submitted {formatSubmittedAt(trackApp.submittedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("pill", STATUS_PILL[trackApp.status])}>{STATUS_LABEL[trackApp.status]}</span>
                    {trackApp.status === "accepted" && (
                      <p className="text-xs font-medium text-success">Congratulations — offer letter ready.</p>
                    )}
                    {trackApp.status === "rejected" && trackApp.notes && (
                      <p className="text-xs text-muted-foreground">{trackApp.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Search className="h-3.5 w-3.5" aria-hidden />
                    Applications move through Submitted → Reviewing → Accepted/Rejected.
                  </div>
                </div>
              ) : trackId.trim() ? (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                  No application found with that ID. Double-check the ID or try applying first.
                </p>
              ) : null}
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}
