"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, DoorOpen, XCircle } from "lucide-react"
import type { Role } from "@/lib/seed-data/core"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

type WithdrawalStatus = "pending" | "approved" | "rejected"

type Withdrawal = {
  id: string
  studentId: string
  studentName: string
  reason: string
  status: WithdrawalStatus
  submittedAt: string
  decidedAt: string | null
  decisionNote: string | null
}

const STATUS_BADGE: Record<WithdrawalStatus, string> = {
  pending: "pill bg-primary/10 text-primary",
  approved: "pill bg-success/10 text-success",
  rejected: "pill bg-destructive/10 text-destructive",
}

const STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

export function WithdrawalsSection({ role }: { role: Role }) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedOk, setSubmittedOk] = useState(false)
  const isStudent = role === "student"

  useEffect(() => {
    let alive = true
    fetch("/api/withdrawals")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) setError(d.error)
        else setWithdrawals(d.withdrawals ?? [])
      })
      .catch(() => alive && setError("Failed to load withdrawal requests."))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const submitRequest = async () => {
    if (!reason.trim() || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const d = await res.json()
      if (!res.ok) {
        setSubmitError(d?.error ?? "Could not submit your request.")
        return
      }
      if (d?.withdrawal) setWithdrawals((prev) => [d.withdrawal, ...prev])
      setSubmittedOk(true)
    } catch {
      setSubmitError("Network error while submitting your request.")
    } finally {
      setSubmitting(false)
    }
  }

  const setStatus = async (id: string, status: WithdrawalStatus) => {
    try {
      const res = await fetch(`/api/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setWithdrawals((prev) =>
          prev.map((w) =>
            w.id === id ? { ...w, status } : w,
          ),
        )
      }
    } catch {
      // Refreshes on next visit
    }
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  const pending = withdrawals.filter((w) => w.status === "pending").length
  const hasPending = pending > 0

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Withdrawal"
        description={
          isStudent
            ? "Request to withdraw from your programme. Your account stays active while the request is reviewed by an admin."
            : "Review withdrawal requests from students. Approving a request records the decision; you can manage the student account separately."
        }
      />

      {isStudent ? (
        <Card className="space-y-4">
          <p className="text-sm font-medium">Submit a withdrawal request</p>
          {!hasPending ? (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain your reason for withdrawing…"
                className="min-h-28 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={submitRequest}
                  disabled={submitting || !reason.trim()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <DoorOpen className="h-4 w-4" aria-hidden /> {submitting ? "Submitting…" : "Request withdrawal"}
                </button>
                <span className="text-xs text-muted-foreground">Only one request can be pending at a time.</span>
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              You already have a pending withdrawal request. Wait for the admin to review it before submitting another.
            </p>
          )}
          {submittedOk && (
            <p className="rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
              Request submitted. Track its status below.
            </p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total requests" value={withdrawals.length} icon={<DoorOpen className="h-5 w-5" />} tone="primary" />
          <StatCard label="Pending review" value={pending} icon={<CheckCircle2 className="h-5 w-5" />} tone="warning" />
          <StatCard label="Approved" value={withdrawals.filter((w) => w.status === "approved").length} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        </div>
      )}

      {withdrawals.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {isStudent ? "You haven't submitted any withdrawal requests." : "No withdrawal requests yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <Card key={w.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isStudent && <p className="font-semibold">{w.studentName}</p>}
                <span className={cn("order-3", STATUS_BADGE[w.status])}>{STATUS_LABEL[w.status]}</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{w.id} · Submitted {w.submittedAt}</p>
              <p className="text-sm text-muted-foreground">{w.reason}</p>
              {w.decisionNote && (
                <p className="text-xs text-muted-foreground">Admin note: {w.decisionNote}</p>
              )}
              {!isStudent && w.status === "pending" && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setStatus(w.id, "approved")}
                    className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve
                  </button>
                  <button
                    onClick={() => setStatus(w.id, "rejected")}
                    className="flex items-center gap-1.5 rounded-sm border border-destructive/40 px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4" aria-hidden /> Reject
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}