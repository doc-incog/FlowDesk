"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  Bell,
  GraduationCap,
  Users,
  UserRound,
  CalendarDays,
  LogOut,
  Menu,
  X,
  Search,
  ClipboardList,
  FileText,
  CreditCard,
  Award,
  ClipboardCheck,
  LifeBuoy,
  MessageSquareText,
  MessageSquare,
  ShieldCheck,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import type { NotificationItem, Role } from "@/lib/seed-data/core"
import { Avatar, RoleBadge } from "@/components/dashboard/primitives"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { AIChat } from "@/components/ai-chat"

import { OverviewSection } from "@/components/dashboard/sections/overview"
import { CheckInSection } from "@/components/dashboard/sections/check-in"
import { NotificationsSection } from "@/components/dashboard/sections/notifications"
import { DirectorySection } from "@/components/dashboard/sections/directory"
import { MentorSection } from "@/components/dashboard/sections/mentor"
import { MenteesSection } from "@/components/dashboard/sections/mentees"
import { ScheduleSection } from "@/components/dashboard/sections/schedule"
import { ExamsSection } from "@/components/dashboard/sections/exams"
import { AssignmentsSection } from "@/components/dashboard/sections/assignments"
import { FeesSection } from "@/components/dashboard/sections/fees"
import { ScholarshipsSection } from "@/components/dashboard/sections/scholarships"
import { AdmissionsSection } from "@/components/dashboard/sections/admissions"
import { HelpdeskSection } from "@/components/dashboard/sections/helpdesk"
import { FeedbackSection } from "@/components/dashboard/sections/feedback"
import { ProfileSection } from "@/components/dashboard/sections/profile"
import { RolesSection } from "@/components/dashboard/sections/roles"
import { ChatSection } from "@/components/dashboard/sections/chat"

export type SectionId =
  | "overview"
  | "checkin"
  | "notifications"
  | "students"
  | "staff"
  | "mentor"
  | "mentees"
  | "chat"
  | "schedule"
  | "exams"
  | "assignments"
  | "fees"
  | "scholarships"
  | "admissions"
  | "helpdesk"
  | "feedback"
  | "profile"
  | "roles"

type NavItem = {
  id: SectionId
  label: string
  icon: typeof LayoutDashboard
  roles: Role[]
}

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["student", "staff", "admin"] },
  { id: "checkin", label: "Check-in", icon: LayoutDashboard, roles: ["student", "staff", "admin"] },
  { id: "notifications", label: "Notifications", icon: Bell, roles: ["student", "staff", "admin"] },
  { id: "students", label: "Students", icon: GraduationCap, roles: ["staff", "admin"] },
  { id: "staff", label: "Staff", icon: Users, roles: ["admin"] },
  { id: "mentor", label: "Mentor", icon: UserRound, roles: ["student", "staff"] },
  { id: "mentees", label: "Mentees", icon: Users, roles: ["admin"] },
  { id: "chat", label: "Messages", icon: MessageSquare, roles: ["student", "staff", "admin"] },
  { id: "schedule", label: "Schedule", icon: CalendarDays, roles: ["student", "staff", "admin"] },
  { id: "exams", label: "Exams & Results", icon: ClipboardList, roles: ["student", "staff", "admin"] },
  { id: "assignments", label: "Assignments", icon: FileText, roles: ["student", "staff", "admin"] },
  { id: "fees", label: "Online Fees", icon: CreditCard, roles: ["student", "admin"] },
  { id: "scholarships", label: "Scholarships", icon: Award, roles: ["student", "admin"] },
  { id: "admissions", label: "Admissions", icon: ClipboardCheck, roles: ["admin"] },
  { id: "helpdesk", label: "Helpdesk", icon: LifeBuoy, roles: ["student", "staff", "admin"] },
  { id: "feedback", label: "Feedback", icon: MessageSquareText, roles: ["student", "staff", "admin"] },
  { id: "profile", label: "Profile", icon: UserRound, roles: ["student", "staff", "admin"] },
  { id: "roles", label: "Roles & permissions", icon: ShieldCheck, roles: ["admin"] },
]

const ROLE_META: Record<Role, { label: string; blurb: string; accent: string }> = {
  student: {
    label: "Student",
    blurb: "Check in, track modules, and stay connected with your mentor.",
    accent: "chart-1",
  },
  staff: {
    label: "Staff",
    blurb: "Manage attendance, classes and mentee guidance.",
    accent: "chart-2",
  },
  admin: {
    label: "Administrator",
    blurb: "Oversee the whole campus, people and biometric access.",
    accent: "chart-3",
  },
}

export function DashboardShell() {
  const router = useRouter()
  const { user, ready, logout } = useAuth()
  const [active, setActive] = useState<SectionId>("overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatarInitials: string; role: string; department: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace("/")
  }, [ready, user, router])

  useEffect(() => {
    let alive = true
    const fetchUnread = () => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((j) => {
          if (!alive) return
          const notifications = (j?.notifications ?? []) as NotificationItem[]
          setUnread(notifications.filter((n) => n.unread).length)
        })
        .catch(() => {
          // badge stays hidden if notifications can't be loaded
        })
    }
    fetchUnread()
    const timer = setInterval(fetchUnread, 5000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const navItems = useMemo(
    () =>
      user
        ? NAV.filter((n) =>
            user.sections?.length ? user.sections.includes(n.id) : n.roles.includes(user.role),
          )
        : [],
    [user],
  )

  if (!ready || !user) {
    return (
      <div className="ambient flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <span className="glass flex h-10 w-10 items-center justify-center rounded-xl">
          <Building2 className="h-5 w-5 animate-pulse text-primary" aria-hidden />
        </span>
      </div>
    )
  }

  const mentorLabel = user.role === "staff" ? "Mentees" : "My Mentor"

  const handleLogout = async () => {
    await logout()
    router.replace("/")
  }

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      setShowSearch(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setSearchResults(data?.users ?? [])
      setShowSearch(true)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const navigateToSearchResult = (result: { role: string }) => {
    setShowSearch(false)
    setSearchQuery("")
    setSearchResults([])
    if (result.role === "student") {
      setActive("students")
    } else if (result.role === "staff") {
      setActive("staff")
    } else {
      setActive("overview")
    }
  }

  const renderSection = () => {
    switch (active) {
      case "overview":
        return <OverviewSection role={user.role} onNavigate={setActive} />
      case "checkin":
        return <CheckInSection role={user.role} userName={user.name} />
      case "notifications":
        return <NotificationsSection role={user.role} />
      case "students":
        return <DirectorySection kind="students" role={user.role} />
      case "staff":
        return <DirectorySection kind="staff" role={user.role} />
      case "mentor":
        return <MentorSection role={user.role} mentorId={user.mentorId} />
      case "mentees":
        return <MenteesSection />
      case "chat":
        return <ChatSection role={user.role} />
      case "schedule":
        return <ScheduleSection role={user.role} />
      case "exams":
        return <ExamsSection role={user.role} />
      case "assignments":
        return <AssignmentsSection role={user.role} />
      case "fees":
        return <FeesSection />
      case "scholarships":
        return <ScholarshipsSection role={user.role} />
      case "admissions":
        return <AdmissionsSection />
      case "helpdesk":
        return <HelpdeskSection role={user.role} />
      case "feedback":
        return <FeedbackSection role={user.role} />
      case "profile":
        return <ProfileSection />
      case "roles":
        return <RolesSection />
      default:
        return null
    }
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Building2 className="h-5 w-5" aria-hidden />
        </div>
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">FlowDesk</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Dashboard sections">
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
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon
                className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/60")}
                aria-hidden
              />
              <span className="flex-1 text-left">{label}</span>
              {item.id === "notifications" && unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar initials={user.avatarInitials} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</p>
            <p className="truncate font-mono text-xs text-sidebar-foreground/50">{user.id}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4.5 w-4.5" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="ambient flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 px-3 py-3 lg:block">
        <div className="glass-strong h-full overflow-hidden rounded-2xl bg-sidebar/70">{SidebarContent}</div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-sidebar-border bg-sidebar">
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/70 px-4 py-3 backdrop-blur lg:top-3 lg:mx-3 lg:rounded-2xl lg:border lg:bg-background/50 lg:shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="text-sm font-medium">{user.roleLabel ?? ROLE_META[user.role]?.label ?? user.role} workspace</span>
            <RoleBadge role={user.role} />
          </div>

          <div className="relative ml-auto hidden max-w-xs flex-1 items-center md:flex">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Search people, modules…"
              className="w-full rounded-lg border border-input bg-card/70 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {searchResults.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => navigateToSearchResult(u)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                      {u.avatarInitials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.role} · {u.department}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-3">
            <ThemeToggle />
            <button
              onClick={() => setActive("notifications")}
              className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
              )}
            </button>
            <button
              onClick={() => setActive("profile")}
              className="rounded-full transition-opacity hover:opacity-80"
              aria-label="Open your profile"
            >
              <Avatar initials={user.avatarInitials} className="h-9 w-9" />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 lg:px-6 lg:py-8">
          <div className="mx-auto max-w-6xl">{renderSection()}</div>
        </main>
      </div>

      <AIChat />
    </div>
  )
}
