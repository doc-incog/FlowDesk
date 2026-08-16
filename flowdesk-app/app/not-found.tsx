import Link from "next/link"
import { Building2 } from "lucide-react"

export default function NotFound() {
  return (
    <main className="ambient flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Building2 className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <p className="font-mono text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.99]"
      >
        Back to login
      </Link>
    </main>
  )
}
