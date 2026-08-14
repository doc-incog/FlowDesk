"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme, type Theme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "Match system" },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("flex items-center gap-0.5 rounded-md border border-border bg-secondary p-0.5", className)}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-7 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors",
            theme === value ? "bg-card text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}
