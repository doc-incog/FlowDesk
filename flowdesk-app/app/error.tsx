"use client"

import { useEffect } from "react"
import { RefreshCcw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("FlowDesk error:", error)
  }, [error])

  return (
    <main className="ambient flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Something went wrong</p>
      <h1 className="max-w-md text-balance text-2xl font-semibold tracking-tight">
        We could not load this page.
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.99]"
      >
        <RefreshCcw className="h-4 w-4" aria-hidden />
        Try again
      </button>
    </main>
  )
}
