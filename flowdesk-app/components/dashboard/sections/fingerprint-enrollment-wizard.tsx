"use client"

import { useEffect, useRef, useState } from "react"
import { Fingerprint, Loader2, CheckCircle2, AlertCircle, MonitorSmartphone } from "lucide-react"
import { Card } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

type Device = {
  device_id: string
  label: string
  location: string
  sensor_type?: string
  last_seen: string | null
  enrolled_count: number
  slots_total: number
}

type WizardStep = "select-device" | "waiting" | "capturing" | "success" | "error"

type SSEEvent = {
  type: string
  command?: string
  commandId?: string
  step?: string
  message?: string
  userId?: string
  fingerId?: number
  status?: string
}

type Props = {
  userId: string
  userName: string
  devices: Device[]
  defaultDeviceId?: string
  onComplete: () => void
  onCancel: () => void
}

const STEP_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  "first-capture": {
    title: "Place your finger on the sensor",
    subtitle: "Hold still until the sensor captures your print.",
  },
  "second-capture": {
    title: "Place the same finger again",
    subtitle: "Remove your finger and place it once more for confirmation.",
  },
  "matched": {
    title: "Fingerprints matched!",
    subtitle: "Storing enrollment on sensor...",
  },
  "stored": {
    title: "Enrollment complete!",
    subtitle: "Fingerprint saved to sensor.",
  },
}

export function FingerprintEnrollmentWizard({ userId, userName, devices, defaultDeviceId, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>(defaultDeviceId ? "waiting" : "select-device")
  const [selectedDevice, setSelectedDevice] = useState(defaultDeviceId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState("")
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      eventSourceRef.current?.close()
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const selectedDeviceInfo = devices.find((d) => d.device_id === selectedDevice)

  /** Open SSE connection for real-time updates. */
  const openSSE = () => {
    eventSourceRef.current?.close()
    const url = `/api/fingerprint/enroll/stream?deviceId=${encodeURIComponent(selectedDevice)}&userId=${encodeURIComponent(userId)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (ev) => {
      if (!mountedRef.current) return
      try {
        const data: SSEEvent = JSON.parse(ev.data)
        handleSSEEvent(data)
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      // SSE will auto-reconnect; we also have polling fallback
    }
  }

  /** Process an SSE event. */
  const handleSSEEvent = (data: SSEEvent) => {
    switch (data.type) {
      case "connected":
        break

      case "command-queued":
        if (data.command === "enroll") {
          setLiveMessage("Enrollment command sent to device...")
        }
        break

      case "enrollment-progress": {
        const msg = data.step ? STEP_MESSAGES[data.step] : null
        if (msg) {
          setLiveMessage(msg.title)
          setStep("capturing")
        }
        break
      }

      case "enrollment-complete":
        setStep("success")
        eventSourceRef.current?.close()
        setTimeout(() => onComplete(), 2000)
        break

      case "enrollment-failed":
        setError(data.message ?? "Enrollment failed on the device.")
        setStep("error")
        eventSourceRef.current?.close()
        break

      case "command-result":
        if (data.status === "failed") {
          setError("Command failed on device.")
          setStep("error")
          eventSourceRef.current?.close()
        }
        break

      case "timeout":
        setError("Timed out waiting for device. Make sure the sensor is online.")
        setStep("error")
        eventSourceRef.current?.close()
        break
    }
  }

  /** Fallback polling if SSE is unavailable. */
  const startPolling = () => {
    let attempts = 0
    const maxAttempts = 120 // 3 minutes at 1.5s intervals

    const poll = async () => {
      if (!mountedRef.current || attempts >= maxAttempts) {
        if (mountedRef.current) {
          setError("Timed out waiting for device. Make sure the sensor is online and try again.")
          setStep("error")
        }
        return
      }

      try {
        const statusRes = await fetch(`/api/fingerprint/enroll/status?userId=${encodeURIComponent(userId)}`)
        const statusData = await statusRes.json()
        if (statusData.enrolled) {
          if (mountedRef.current) {
            setStep("success")
            eventSourceRef.current?.close()
            setTimeout(() => onComplete(), 2000)
          }
          return
        }
      } catch { /* retry */ }

      attempts++
      pollRef.current = setTimeout(poll, 1500)
    }

    pollRef.current = setTimeout(poll, 2000)
  }

  const startEnrollment = async () => {
    if (!selectedDevice) return
    setStep("waiting")
    setLiveMessage("Sending enrollment command...")

    try {
      const res = await fetch("/api/fingerprint/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, deviceId: selectedDevice, template: "" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to start enrollment")
        setStep("error")
        return
      }

      // Open SSE for real-time updates
      openSSE()
      // Also start polling as fallback
      startPolling()
    } catch {
      setError("Could not reach server")
      setStep("error")
    }
  }

  return (
    <Card className="mx-auto max-w-md overflow-hidden">
      {/* Step indicator */}
      <div className="flex items-center gap-1 border-b border-border px-5 py-3">
        {(step === "select-device") && (
          <>
            <StepDot active />
            <StepLabel>Device</StepLabel>
            <StepDot />
            <StepLabel dim>Capture</StepLabel>
            <StepDot />
            <StepLabel dim>Done</StepLabel>
          </>
        )}
        {(step === "waiting" || step === "capturing") && (
          <>
            <StepDot done />
            <StepLabel dim>Device</StepLabel>
            <StepDot active={step === "waiting"} done={step === "capturing"} />
            <StepLabel>{step === "capturing" ? "Capture" : "Waiting"}</StepLabel>
            <StepDot />
            <StepLabel dim>Done</StepLabel>
          </>
        )}
        {(step === "success" || step === "error") && (
          <>
            <StepDot done />
            <StepLabel dim>Device</StepLabel>
            <StepDot done />
            <StepLabel dim>Capture</StepLabel>
            <StepDot done={step === "success"} active={step === "error"} />
            <StepLabel>{step === "success" ? "Done" : "Error"}</StepLabel>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-5 px-5 py-8">
        {/* SELECT DEVICE */}
        {step === "select-device" && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-secondary">
              <MonitorSmartphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Select Fingerprint Device</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the sensor where <span className="font-medium text-foreground">{userName}</span> will place their finger.
              </p>
            </div>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Select device...</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.label || d.device_id} — {d.location || "No location"} ({d.enrolled_count}/{d.slots_total} slots)
                </option>
              ))}
            </select>
            {devices.length === 0 && (
              <p className="text-sm text-destructive">No devices registered. Add a device in the Fingerprint admin page first.</p>
            )}
            <div className="flex gap-3">
              <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary">
                Cancel
              </button>
              <button
                onClick={startEnrollment}
                disabled={!selectedDevice}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                <Fingerprint className="h-4 w-4" /> Start Enrollment
              </button>
            </div>
          </>
        )}

        {/* WAITING — command sent, waiting for ESP */}
        {step === "waiting" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-semibold">Waiting for device...</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Enrolling <span className="font-medium text-foreground">{userName}</span> on{' '}
                <span className="font-mono text-xs">{selectedDeviceInfo?.label || selectedDevice}</span>
              </p>
              {liveMessage && <p className="mt-2 text-sm text-primary">{liveMessage}</p>}
            </div>
          </>
        )}

        {/* CAPTURING — live feedback from sensor */}
        {step === "capturing" && (
          <>
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
                <Fingerprint className="h-12 w-12 text-primary" />
              </div>
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{liveMessage || "Place your finger on the sensor"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow the instructions on the sensor or serial monitor.
              </p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <>
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-success bg-success/10">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-success">Fingerprint enrolled!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium">{userName}</span> can now check in at the sensor.
              </p>
            </div>
          </>
        )}

        {/* ERROR */}
        {step === "error" && (
          <>
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-destructive">Enrollment failed</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary">
                Cancel
              </button>
              <button
                onClick={() => { setError(null); setLiveMessage(""); setStep("waiting"); startEnrollment() }}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function StepDot({ active, done }: { active?: boolean; done?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-3 w-3 items-center justify-center rounded-full border-2",
        done && "border-primary bg-primary",
        active && "border-primary bg-primary/20",
        !done && !active && "border-border bg-secondary",
      )}
    >
      {done && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
    </span>
  )
}

function StepLabel({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span className={cn("text-xs font-medium", dim ? "text-muted-foreground" : "text-foreground")}>
      {children}
    </span>
  )
}
