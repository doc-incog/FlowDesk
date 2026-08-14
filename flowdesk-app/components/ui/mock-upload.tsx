"use client"

import { useRef, useState } from "react"
import { UploadCloud, X } from "lucide-react"

export function MockFileUpload({
  label,
  onSelect,
  className,
}: {
  label?: string
  onSelect: (name: string) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setName(f.name)
            onSelect(f.name)
          }
        }}
      />
      {name ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{name}</span>
          <button
            type="button"
            onClick={() => {
              setName("")
              onSelect("")
              if (inputRef.current) inputRef.current.value = ""
            }}
            aria-label="Remove file"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <UploadCloud className="h-4 w-4" aria-hidden /> {label ?? "Attach a file"}
        </button>
      )}
    </div>
  )
}
