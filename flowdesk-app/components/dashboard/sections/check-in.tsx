"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Fingerprint, ScanLine } from "lucide-react"
import type { CheckInRecord, Role } from "@/lib/seed-data/core"
import { BiometricScanner } from "@/components/biometric-scanner"
import { Card, RoleBadge, SectionHeading, StatusBadge } from "@/components/dashboard/primitives"

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function CheckInSection({ userName }: { role: Role; userName: string }) {
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkinError, setCheckinError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/checkins")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j?.error) setError(j.error)
        else setRecords(j?.records ?? [])
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const handleVerified = async (method: "webauthn" | "biometric") => {
    if (checkedIn || busy) return
    setBusy(true)
    setCheckinError(null)
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (data?.record || data?.alreadyCheckedIn) {
        setCheckedIn(true)
        if (data?.record) setRecords((prev) => [data.record, ...prev])
      } else {
        setCheckinError(data?.error ?? "Check-in failed")
      }
    } catch {
      setCheckinError("Check-in failed")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  const present = records.filter((r) => r.status !== "absent").length
  const late = records.filter((r) => r.status === "late").length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Biometric check-in"
        description="Place your finger on the scanner to record attendance. Uses device biometrics via WebAuthn where available."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Scanner */}
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
          ) : (
            <>
              {checkinError && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {checkinError}
                </p>
              )}
              <BiometricScanner label="Tap to check in" onVerified={handleVerified} />
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                Demo simulation: your fingerprint template never leaves the device — only a pass/fail signal is recorded.
              </p>
            </>
          )}
        </Card>

        {/* Stats + device */}
        <div className="space-y-4 lg:col-span-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <p className="font-mono text-xl font-bold">7/8</p>
                <p className="text-xs text-muted-foreground">Devices online</p>
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
                <ScanLine className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Science Block — Scanner #3</p>
                <p className="text-xs text-muted-foreground">Last sync {nowTime()}</p>
              </div>
              <span className="pill bg-success/10 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> Online
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Log */}
      <Card>
        <SectionHeading title="Today's check-in log" description={`${records.length} entries`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-2.5 text-center text-muted-foreground">No check-ins for this date yet.</td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 font-medium">{r.name}</td>
                    <td className="py-2.5"><RoleBadge role={r.role} /></td>
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
    </div>
  )
}
