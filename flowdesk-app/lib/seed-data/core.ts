/** A role key. Built-ins are student/staff/admin; admins can add custom keys. */
export type Role = string

export type UserProfile = {
  id: string
  name: string
  role: Role
  email: string
  avatarInitials: string
  department: string
  // dashboard visibility (effective for the signed-in user)
  sections?: string[]
  roleLabel?: string
  // student-specific
  batch?: string
  semester?: string
  rollNo?: string
  mentorId?: string
  // staff-specific
  designation?: string
  subjects?: string[]
  // contact / personal info
  phone?: string
  address?: string
  guardianName?: string
  guardianPhone?: string
  emergencyContact?: string
  dob?: string
}

export type CheckInRecord = {
  id: string
  userId?: string
  name: string
  role: Role
  time: string
  status: "on-time" | "late" | "absent"
  method: "biometric" | "webauthn" | "manual"
}

export type NotificationItem = {
  id: string
  title: string
  body: string
  time: string
  category: "academic" | "event" | "alert" | "system"
  unread: boolean
  createdAt?: string
}

export type ScheduleSlot = {
  id: string
  day: string
  start: string
  end: string
  module: string
  code: string
  room: string
  staff: string
}

export type Mentor = {
  id: string
  name: string
  designation: string
  department: string
  email: string
  phone: string
  office: string
  officeHours: string
  avatarInitials: string
  mentees: number
}

export const ADMIN_CREDS = {
  email: "admin@flowdesk.edu",
  password: "flowdesk-admin@2026",
}

import { DEFAULT_PASSWORD, SECTION_KEYS } from "@/lib/constants"
export { DEFAULT_PASSWORD, SECTION_KEYS }

/** Default section visibility per role — the seed for role_permissions. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  student: [
    "overview", "checkin", "notifications", "mentor", "chat", "schedule", "exams",
    "assignments", "fees", "scholarships", "helpdesk", "feedback", "profile",
  ],
  staff: [
    "overview", "checkin", "notifications", "students", "mentor", "chat", "schedule",
    "exams", "assignments", "helpdesk", "feedback", "profile",
  ],
  admin: SECTION_KEYS.filter((s) => s !== "mentor"),
}

export const ROLE_META: Record<Role, { label: string; blurb: string; accent: string }> = {
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

export const DEMO_USERS: Record<Role, UserProfile> = {
  student: {
    id: "STU-2043",
    name: "Aisha Karim",
    role: "student",
    email: "aisha.karim@campus.edu",
    avatarInitials: "AK",
    department: "Computer Science",
    batch: "2023–2027",
    semester: "Semester 5",
    rollNo: "CS23-2043",
    mentorId: "MEN-01",
  },
  staff: {
    id: "STF-118",
    name: "Dr. Rahul Menon",
    role: "staff",
    email: "rahul.menon@campus.edu",
    avatarInitials: "RM",
    department: "Computer Science",
    designation: "Associate Professor",
    subjects: ["Data Structures", "Operating Systems"],
  },
  admin: {
    id: "ADM-004",
    name: "Priya Sharma",
    role: "admin",
    email: "priya.sharma@campus.edu",
    avatarInitials: "PS",
    department: "Administration",
    designation: "Campus Registrar",
  },
}

export const CHECK_INS: CheckInRecord[] = [
  { id: "c1", name: "Aisha Karim", role: "student", time: "08:42 AM", status: "on-time", method: "biometric" },
  { id: "c2", name: "Dev Patel", role: "student", time: "08:55 AM", status: "on-time", method: "webauthn" },
  { id: "c3", name: "Dr. Rahul Menon", role: "staff", time: "08:30 AM", status: "on-time", method: "biometric" },
  { id: "c4", name: "Sara Lin", role: "student", time: "09:18 AM", status: "late", method: "biometric" },
  { id: "c5", name: "Omar Faruk", role: "student", time: "—", status: "absent", method: "manual" },
  { id: "c6", name: "Dr. Neha Gupta", role: "staff", time: "08:48 AM", status: "on-time", method: "webauthn" },
  { id: "c7", name: "Liam Wong", role: "student", time: "09:05 AM", status: "late", method: "biometric" },
]

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Mid-term timetable released",
    body: "The Semester 5 mid-term examination schedule is now available in the schedule section.",
    time: "12 min ago",
    category: "academic",
    unread: true,
  },
  {
    id: "n2",
    title: "Biometric device #3 back online",
    body: "The fingerprint scanner at the Science Block entrance has been restored.",
    time: "1 hr ago",
    category: "system",
    unread: true,
  },
  {
    id: "n3",
    title: "Tech fest registrations open",
    body: "Register for CampusHack 2026 before Friday to secure your team slot.",
    time: "3 hr ago",
    category: "event",
    unread: false,
  },
  {
    id: "n4",
    title: "Low attendance warning",
    body: "3 students in CS23 have dropped below the 75% attendance threshold.",
    time: "Yesterday",
    category: "alert",
    unread: false,
  },
]

export const SCHEDULE: ScheduleSlot[] = [
  { id: "s1", day: "Mon", start: "09:00", end: "10:30", module: "Data Structures", code: "CS301", room: "B-204", staff: "Dr. Rahul Menon" },
  { id: "s2", day: "Mon", start: "11:00", end: "12:30", module: "Database Systems", code: "CS304", room: "B-210", staff: "Dr. Neha Gupta" },
  { id: "s3", day: "Tue", start: "09:00", end: "10:30", module: "Operating Systems", code: "CS302", room: "A-101", staff: "Dr. Rahul Menon" },
  { id: "s4", day: "Wed", start: "10:30", end: "12:00", module: "Computer Networks", code: "CS305", room: "B-204", staff: "Prof. Karan Rao" },
  { id: "s5", day: "Thu", start: "09:00", end: "10:30", module: "Software Engineering", code: "CS306", room: "C-115", staff: "Dr. Neha Gupta" },
  { id: "s6", day: "Fri", start: "11:00", end: "12:30", module: "Theory of Computation", code: "CS303", room: "A-101", staff: "Prof. Karan Rao" },
  { id: "s7", day: "Sun", start: "10:00", end: "12:00", module: "Python Workshop", code: "CS310", room: "C-101", staff: "Dr. Neha Gupta" },
]

export const MENTORS: Mentor[] = [
  {
    id: "MEN-01",
    name: "Dr. Rahul Menon",
    designation: "Associate Professor",
    department: "Computer Science",
    email: "rahul.menon@campus.edu",
    phone: "+91 98765 43210",
    office: "Faculty Block, Room 214",
    officeHours: "Mon & Wed, 2:00–4:00 PM",
    avatarInitials: "RM",
    mentees: 12,
  },
  {
    id: "MEN-02",
    name: "Dr. Neha Gupta",
    designation: "Assistant Professor",
    department: "Computer Science",
    email: "neha.gupta@campus.edu",
    phone: "+91 98111 22334",
    office: "Faculty Block, Room 209",
    officeHours: "Tue & Thu, 11:00 AM–1:00 PM",
    avatarInitials: "NG",
    mentees: 9,
  },
]

export const STUDENTS: UserProfile[] = [
  { id: "STU-2043", name: "Aisha Karim", role: "student", email: "aisha.karim@campus.edu", avatarInitials: "AK", department: "Computer Science", semester: "Semester 5", rollNo: "CS23-2043", mentorId: "MEN-01" },
  { id: "STU-2044", name: "Dev Patel", role: "student", email: "dev.patel@campus.edu", avatarInitials: "DP", department: "Computer Science", semester: "Semester 5", rollNo: "CS23-2044", mentorId: "MEN-01" },
  { id: "STU-2045", name: "Sara Lin", role: "student", email: "sara.lin@campus.edu", avatarInitials: "SL", department: "Computer Science", semester: "Semester 5", rollNo: "CS23-2045", mentorId: "MEN-02" },
  { id: "STU-2046", name: "Omar Faruk", role: "student", email: "omar.faruk@campus.edu", avatarInitials: "OF", department: "Computer Science", semester: "Semester 5", rollNo: "CS23-2046", mentorId: "MEN-02" },
  { id: "STU-2047", name: "Liam Wong", role: "student", email: "liam.wong@campus.edu", avatarInitials: "LW", department: "Computer Science", semester: "Semester 5", rollNo: "CS23-2047", mentorId: "MEN-01" },
]

export const STAFF: UserProfile[] = [
  { id: "STF-118", name: "Dr. Rahul Menon", role: "staff", email: "rahul.menon@campus.edu", avatarInitials: "RM", department: "Computer Science", designation: "Associate Professor", subjects: ["Data Structures", "Operating Systems"] },
  { id: "STF-119", name: "Dr. Neha Gupta", role: "staff", email: "neha.gupta@campus.edu", avatarInitials: "NG", department: "Computer Science", designation: "Assistant Professor", subjects: ["Database Systems", "Software Engineering"] },
  { id: "STF-120", name: "Prof. Karan Rao", role: "staff", email: "karan.rao@campus.edu", avatarInitials: "KR", department: "Computer Science", designation: "Professor", subjects: ["Computer Networks", "Theory of Computation"] },
]

export const CAMPUS_STATS = {
  totalStudents: 1284,
  totalStaff: 96,
  presentToday: 1147,
  biometricDevices: 8,
  devicesOnline: 7,
  avgAttendance: 89,
}
