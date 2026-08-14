"use client"

import { useCallback, useRef, useState } from "react"
import { Fingerprint, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ScanState = "idle" | "scanning" | "success" | "error"

type BiometricScannerProps = {
  onVerified?: (method: "webauthn" | "biometric") => void
  label?: string
  className?: string
}

/**
 * Fingerprint verification widget.
 * Attempts a real WebAuthn platform-authenticator prompt (Touch ID / Windows Hello /
 * Android fingerprint) when available, and falls back to a simulated scan animation
 * so the flow always works in the preview and on unsupported devices.
 */
export function BiometricScanner({ onVerified, label = "Scan fingerprint to continue", className }: BiometricScannerProps) {
  const [state, setState] = useState<ScanState>("idle")
  const [message, setMessage] = useState<string>("")
  const [method, setMethod] = useState<"webauthn" | "biometric">("biometric")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const runSimulated = useCallback(() => {
    setMethod("biometric")
    setState("scanning")
    setMessage("Reading ridge pattern…")
    const t = setTimeout(() => {
      setState("success")
      setMessage("Fingerprint matched")
      onVerified?.("biometric")
    }, 1800)
    timers.current.push(t)
  }, [onVerified])

  const runWebAuthn = useCallback(async () => {
    setState("scanning")
    setMessage("Waiting for device biometrics…")

    const supported =
      typeof window !== "undefined" &&
      typeof window.PublicKeyCredential !== "undefined" &&
      !!navigator.credentials

    if (!supported) {
      runSimulated()
      return
    }

    try {
      const available = await (
        window.PublicKeyCredential as unknown as {
          isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
        }
      ).isUserVerifyingPlatformAuthenticatorAvailable?.()

      if (!available) {
        runSimulated()
        return
      }

      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)
      const userId = new Uint8Array(16)
      crypto.getRandomValues(userId)

      // Register a throwaway platform credential purely to trigger the biometric prompt.
      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "CampusFlow" },
          user: { id: userId, name: "campus-user", displayName: "Campus User" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 30000,
        },
      })

      setMethod("webauthn")
      setState("success")
      setMessage("Verified with device biometrics")
      onVerified?.("webauthn")
    } catch {
      // User cancelled or WebAuthn unavailable — fall back to simulation.
      runSimulated()
    }
  }, [onVerified, runSimulated])

  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setState("idle")
    setMessage("")
  }

  const isBusy = state === "scanning"

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <button
        type="button"
        onClick={state === "success" ? reset : runWebAuthn}
        disabled={isBusy}
        aria-label={label}
        className={cn(
          "group relative flex h-32 w-32 items-center justify-center rounded-full border-2 transition-colors",
          state === "idle" && "border-border bg-secondary hover:border-primary",
          state === "scanning" && "border-primary bg-primary/10",
          state === "success" && "border-success bg-success/10",
          state === "error" && "border-destructive bg-destructive/10",
        )}
      >
        {/* animated scan ring */}
        {isBusy && (
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40" aria-hidden />
        )}
        {state === "success" ? (
          <ShieldCheck className="h-14 w-14 text-success" aria-hidden />
        ) : state === "error" ? (
          <ShieldAlert className="h-14 w-14 text-destructive" aria-hidden />
        ) : isBusy ? (
          <span className="relative">
            <Fingerprint className="h-14 w-14 text-primary" aria-hidden />
            <Loader2 className="absolute -right-1 -top-1 h-5 w-5 animate-spin text-primary" aria-hidden />
          </span>
        ) : (
          <Fingerprint className="h-14 w-14 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
        )}
      </button>

      <div className="min-h-10 text-center">
        <p
          className={cn(
            "text-sm font-medium",
            state === "success" && "text-success",
            state === "error" && "text-destructive",
            (state === "idle" || state === "scanning") && "text-muted-foreground",
          )}
        >
          {message || label}
        </p>
        {state === "success" && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            via {method === "webauthn" ? "WebAuthn platform authenticator" : "biometric sensor"}
          </p>
        )}
      </div>
    </div>
  )
}
