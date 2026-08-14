"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  Fingerprint,
  Bell,
  GraduationCap,
  Users,
  UserRound,
  CalendarDays,
  LogOut,
  Menu,
  X,
  Search,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { NOTIFICATIONS, ROLE_META, type Role } from "@/lib/mock-data"
import { Avatar, RoleBadge } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

import { OverviewSection } from "@/components/dashboard/sections/overview"
import { CheckInSection } from "@/components/dashboard/sections/check-in"
import { NotificationsSection } from "@/components/dashboard/sections/notifications"
import { DirectorySection } from "@/components/dashboard/sections/directory"
import { MentorSection } from "@/components/dashboard/sections/mentor"
import { ScheduleSection } from "@/components/dashboard/sections/schedule"

export type SectionId =
  | "overview"
  | "checkin"
  | "notifications"
  | "students"
  | "staff"
  | "mentor"
  | "schedule"

type NavItem = {
  id: SectionId
  label: string
  icon: typeof LayoutDashboard
  roles: Role[]
}

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["student", "staff", "admin"] },
  { id: "checkin", label: "Check-in", icon: Fingerprint, roles: ["student", "staff", "admin"] },
  { id: "notifications", label: "Notifications", icon: Bell, roles: ["student", "staff", "admin"] },
  { id: "students", label: "Students", icon: GraduationCap, roles: ["staff", "admin"] },
  { id: "staff", label: "Staff", icon: Users, roles: ["admin"] },
  { id: "mentor", label: "Mentor", icon: UserRound, roles: ["student", "staff"] },
  { id: "schedule", label: "Schedule", icon: CalendarDays, roles: ["student", "staff", "admin"] },
]

export function DashboardShell() {
  const router = useRouter()
  const { user, ready, logout } = useAuth()
  const [active, setActive] = useState<SectionId>("overview")
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace("/")
  }, [ready, user, router])

  const navItems = useMemo(() => (user ? NAV.filter((n) => n.roles.includes(user.role)) : []), [user])

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Fingerprint className="h-6 w-6 animate-pulse" aria-hidden />
      </div>
    )
  }

  const mentorLabel = user.role === "staff" ? "Mentees" : "My Mentor"
  const unread = NOTIFICATIONS.filter((n) => n.unread).length

  const handleLogout = () => {
    logout()
    router.replace("/")
  }

  const renderSection = () => {
    switch (active) {
      case "overview":
        return <OverviewSection role={user.role} onNavigate={setActive} />
      case "checkin":
        return <CheckInSection role={user.role} userName={user.name} />
      case "notifications":
        return <NotificationsSection />
      case "students":
        return <DirectorySection kind="students" role={user.role} />
      case "staff":
        return <DirectorySection kind="staff" role={user.role} />
      case "mentor":
        return <MentorSection role={user.role} mentorId={user.mentorId} />
      case "schedule":
        return <ScheduleSection role={user.role} />
      default:
        return null
    }
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="h-5 w-5" aria-hidden />
        </div>
        <span className="text-base font-bold tracking-tight text-sidebar-foreground">CampusFlow</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Dashboard sections">
        {navItems.map((item) => {
          const isActive = active === item.id
          const label = item.id === "mentor" ? mentorLabel : item.label
          return (
            <button
              key={item.id}
              onClick={() => {
                setActive(item.id)
                setMobileOpen(false)
              }}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {item.id === "notifications" && unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar initials={user.avatarInitials} className="bg-sidebar-accent text-sidebar-accent-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</p>
            <p className="truncate font-mono text-xs text-sidebar-foreground/60">{user.id}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4.5 w-4.5" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar lg:block">{SidebarContent}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-sidebar-foreground/70"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm font-semibold">{ROLE_META[user.role].label} workspace</span>
            <RoleBadge role={user.role} />
          </div>

          <div className="relative ml-auto hidden max-w-xs flex-1 items-center md:flex">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              type="search"
              placeholder="Search people, modules…"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <button
            onClick={() => setActive("notifications")}
            className="relative ml-auto rounded-lg p-2 text-muted-foreground hover:bg-secondary md:ml-0"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
            )}
          </button>

          <Avatar initials={user.avatarInitials} className="h-9 w-9" />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{renderSection()}</div>
        </main>
      </div>
    </div>
  )
}
