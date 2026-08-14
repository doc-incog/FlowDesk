"use client"

import { Mail, Phone, MapPin, Clock, CalendarPlus, Users } from "lucide-react"
import { MENTORS, STUDENTS, type Role } from "@/lib/mock-data"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"

export function MentorSection({ role, mentorId }: { role: Role; mentorId?: string }) {
  // Staff members see their mentees; students see their assigned mentor.
  if (role === "staff") {
    const mentees = STUDENTS.filter((s) => s.mentorId === "MEN-01")
    return (
      <div className="space-y-6">
        <SectionHeading title="My mentees" description={`${mentees.length} students under your mentorship`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mentees.map((s) => (
            <Card key={s.id} className="flex items-center gap-4">
              <Avatar initials={s.avatarInitials} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">{s.rollNo} · {s.semester}</p>
              </div>
              <a
                href={`mailto:${s.email}`}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={`Email ${s.name}`}
              >
                <Mail className="h-4 w-4" aria-hidden />
              </a>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const mentor = MENTORS.find((m) => m.id === mentorId) ?? MENTORS[0]

  return (
    <div className="space-y-6">
      <SectionHeading title="My mentor" description="Your assigned faculty mentor and how to reach them." />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col items-center gap-4 bg-secondary/60 px-6 py-8 text-center sm:flex-row sm:text-left">
          <Avatar initials={mentor.avatarInitials} className="h-20 w-20 bg-primary text-xl text-primary-foreground" />
          <div>
            <p className="text-xl font-bold">{mentor.name}</p>
            <p className="text-sm text-muted-foreground">{mentor.designation} · {mentor.department}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden /> {mentor.mentees} mentees
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={mentor.email} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={mentor.phone} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Office" value={mentor.office} />
          <InfoRow icon={<Clock className="h-4 w-4" />} label="Office hours" value={mentor.officeHours} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-6 sm:flex-row">
          <a
            href={`mailto:${mentor.email}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Mail className="h-4 w-4" aria-hidden /> Message mentor
          </a>
          <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary">
            <CalendarPlus className="h-4 w-4" aria-hidden /> Book a meeting
          </button>
        </div>
      </Card>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
