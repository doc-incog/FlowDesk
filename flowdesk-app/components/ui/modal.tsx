"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-xl",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-bold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
