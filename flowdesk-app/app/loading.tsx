import { Building2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="ambient flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <div className="glass flex h-10 w-10 items-center justify-center rounded-xl">
        <Building2 className="h-5 w-5 animate-pulse text-primary" aria-hidden />
      </div>
      <span className="sr-only">Loading FlowDesk…</span>
    </div>
  )
}
