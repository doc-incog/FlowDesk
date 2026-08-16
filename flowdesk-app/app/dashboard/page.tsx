import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/shell"

export const metadata: Metadata = {
  title: "Dashboard — FlowDesk",
  description:
    "Your FlowDesk dashboard: schedule, attendance, fees, assignments, exams and more.",
  robots: { index: false, follow: false },
}

export default function DashboardPage() {
  return <DashboardShell />
}
