"use client"

import { useState } from "react"
import { CheckCircle2, Clock, Fingerprint, ScanLine } from "lucide-react"
import { CHECK_INS, type CheckInRecord, type Role } from "@/lib/mock-data"
import { BiometricScanner } from "@/components/biometric-scanner"
import { Card, RoleBadge, SectionHeading, StatusBadge } from "@/components/dashboard/primitives"

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function CheckInSection({ role, userName }: { role: Role; userName: string }) {
  const [records, setRecords] = useState<CheckInRecord[]>(CHECK_INS)
  const [checkedIn, setCheckedIn] = useState(false)

  const handleVerified = (method: "webauthn" | "biometric") => {
    if (checkedIn) return
    setCheckedIn(true)
    setRecords((prev) => [
      {
        id: `me-${Date.now()}`,
        name: userName,
        role,
        time: nowTime(),
        status: "on-time",
        method,
      },
      ...prev,
    ])
  }

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
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-success bg-success/10">
                <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
              </span>
              <div>
                <p className="text-lg font-bold text-success">You&apos;re checked in</p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">{userName} · {nowTime()}</p>
              </div>
              <button
                onClick={() => setCheckedIn(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Reset demo
              </button>
            </div>
          ) : (
            <>
              <BiometricScanner label="Tap to check in" onVerified={handleVerified} />
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                Your fingerprint template never leaves the device — only a pass/fail signal is recorded.
              </p>
            </>
          )}
        </Card>

        {/* Stats + device */}
        <div className="space-y-4 lg:col-span-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-mono text-xl font-bold">{present}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Clock className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-mono text-xl font-bold">{late}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ScanLine className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Science Block — Scanner #3</p>
                <p className="text-xs text-muted-foreground">Last sync {nowTime()}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
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
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 font-medium">{r.name}</td>
                  <td className="py-2.5"><RoleBadge role={r.role} /></td>
                  <td className="py-2.5 font-mono text-muted-foreground">{r.time}</td>
                  <td className="py-2.5 capitalize text-muted-foreground">{r.method}</td>
                  <td className="py-2.5 text-right"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
