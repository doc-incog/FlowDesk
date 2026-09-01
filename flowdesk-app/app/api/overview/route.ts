import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDate } from "@/lib/datetime"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const today = localDate()

  const slots = db
    .prepare("SELECT id, day, start, end, module, code, room, staff FROM schedule_slots ORDER BY day, start")
    .all() as {
    id: string
    day: string
    start: string
    end: string
    module: string
    code: string
    room: string
    staff: string
  }[]

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "short" })
  const todaysClasses = slots
    .filter((s) => s.day === todayName)
    .map((s) => ({ id: s.id, day: s.day, start: s.start, end: s.end, module: s.module, code: s.code, room: s.room, staff: s.staff }))

  const notifications = db
    .prepare(
      `SELECT n.id, n.title, n.body, n.time, n.category, n.created_at,
        CASE WHEN nr.user_id IS NOT NULL THEN 0 ELSE 1 END as unread
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE ((n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = ?)) OR n.user_id = ?)
       ORDER BY CASE n.category WHEN 'alert' THEN 0 WHEN 'academic' THEN 1 WHEN 'event' THEN 2 ELSE 3 END, n.created_at DESC
       LIMIT 3`,
    )
    .all(user.id, user.role, user.id) as { id: string; title: string; body: string; time: string; category: string; created_at: string; unread: number }[]
  const notices = notifications
    .filter((n) => n.unread === 1)
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      time: n.time,
      category: n.category,
      unread: true,
      createdAt: n.created_at || undefined,
    }))

  const checkIns = db
    .prepare("SELECT c.user_id, u.name, u.role, c.time, c.status, c.method, c.source FROM check_ins c JOIN users u ON u.id = c.user_id WHERE substr(c.created_at, 1, 10) = ?")
    .all(today) as {
    user_id: string
    name: string
    role: string
    time: string
    status: string
    method: string
    source: string
  }[]

  const presentCount = checkIns.filter((c) => c.status !== "absent").length
  const avgAttendance = checkIns.length > 0 ? Math.round((presentCount / checkIns.length) * 100) : 0

  const studentIds = db.prepare("SELECT id FROM users WHERE role = 'student' AND is_deleted = 0").all() as { id: string }[]
  const staffCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'staff' AND is_deleted = 0").get() as { n: number }).n

  // Live fingerprint device stats from DB
  const fpDevices = db.prepare("SELECT device_id, last_seen, enrolled_count FROM fingerprint_devices").all() as {
    device_id: string; last_seen: string | null; enrolled_count: number
  }[]
  const totalDevices = fpDevices.length
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const onlineDevices = fpDevices.filter((d) => d.last_seen && d.last_seen > fiveMinAgo).length
  const CAMPUS = { biometricDevices: totalDevices || 0, devicesOnline: onlineDevices }

  const myCheckIn = checkIns.find((c) => c.user_id === user.id)
  const myHistory = db
    .prepare("SELECT status FROM check_ins WHERE user_id = ?")
    .all(user.id) as { status: string }[]
  const attendancePercent =
    myHistory.length > 0
      ? Math.round((myHistory.filter((h) => h.status !== "absent").length / myHistory.length) * 100)
      : 0

  const stats =
    user.role === "admin"
      ? [
          { label: "Total students", value: studentIds.length.toLocaleString(), hint: undefined, tone: "primary" as const, icon: "graduation" },
          { label: "Total staff", value: staffCount, hint: undefined, tone: "chart-5" as const, icon: "users" },
          { label: "Present today", value: presentCount.toLocaleString(), hint: `${avgAttendance}% attendance`, tone: "success" as const, icon: "shield" },
          { label: "Biometric devices", value: `${CAMPUS.devicesOnline}/${CAMPUS.biometricDevices}`, hint: "online", tone: "warning" as const, icon: "fingerprint" },
        ]
      : user.role === "staff"
        ? [
            { label: "My mentees", value: db.prepare("SELECT COUNT(*) AS n FROM users WHERE mentor_id = (SELECT id FROM mentors WHERE name = ?) AND is_deleted = 0").get(user.name)?.n ?? 0, hint: undefined, tone: "primary" as const, icon: "user" },
            { label: "Classes today", value: todaysClasses.filter((s) => s.staff === user.name).length, hint: undefined, tone: "chart-5" as const, icon: "calendar" },
            { label: "Present today", value: `${avgAttendance}%`, hint: "across your modules", tone: "success" as const, icon: "shield" },
            { label: "Unread alerts", value: notices.length, hint: undefined, tone: "warning" as const, icon: "bell" },
          ]
        : [
            { label: "My attendance", value: `${attendancePercent}%`, hint: "this semester", tone: "success" as const, icon: "trending" },
            { label: "Classes today", value: todaysClasses.length, hint: undefined, tone: "primary" as const, icon: "calendar" },
            { label: "Check-in status", value: myCheckIn ? (myCheckIn.status === "on-time" ? "Done" : myCheckIn.status) : "Pending", hint: myCheckIn ? `${myCheckIn.time} · ${myCheckIn.status}` : "not checked in yet", tone: "chart-5" as const, icon: "fingerprint" },
            { label: "Unread notices", value: notices.length, hint: undefined, tone: "warning" as const, icon: "bell" },
          ]

  const recentCheckIns =
    user.role === "student"
      ? []
      : db
          .prepare(
            `SELECT c.user_id, u.name, c.time, c.status FROM check_ins c
             JOIN users u ON u.id = c.user_id
             WHERE c.status != 'absent' AND substr(c.created_at, 1, 10) = ? ORDER BY c.created_at DESC LIMIT 5`,
          )
          .all(today)
          .map((c) => {
            const row = c as { user_id: string; name: string; time: string; status: string }
            const student = db.prepare("SELECT roll_no FROM users WHERE id = ?").get(row.user_id) as { roll_no: string | null } | undefined
            return { name: row.name, rollNo: student?.roll_no ?? "", time: row.time, status: row.status as "on-time" | "late" }
          })

  return NextResponse.json({ stats, todaysClasses, notices, recentCheckIns })
}
