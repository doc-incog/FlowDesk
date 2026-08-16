import type { DatabaseSync } from "node:sqlite"
import {
  ADMIN_CREDS,
  CHECK_INS,
  DEMO_USERS,
  MENTORS,
  NOTIFICATIONS,
  SCHEDULE,
  STAFF,
  STUDENTS,
} from "@/lib/seed-data/core"
import { ADMISSION_APPLICATIONS, PROGRAMS } from "@/lib/seed-data/admissions"
import { ASSIGNMENTS, SUBMISSIONS } from "@/lib/seed-data/assignments"
import { EXAMINATIONS, RESULTS } from "@/lib/seed-data/exams"
import { FEE_STRUCTURE, RECEIPTS } from "@/lib/seed-data/fees"
import { COMPLAINTS } from "@/lib/seed-data/helpdesk"
import { SCHOLARSHIPS, SCHOLARSHIP_APPLICATIONS } from "@/lib/seed-data/scholarships"
import { FEEDBACK_ENTRIES, FEEDBACK_TARGETS } from "@/lib/seed-data/feedback"
import { hashPassword } from "@/lib/db/password"
import { localDateTime } from "@/lib/datetime"

/**
 * Seeds the database from the isolated mock dataset in lib/seed-data.
 * Control with SEED env var: SEED=false skips seeding entirely.
 * Idempotent: only seeds when the users table is empty, so restarting the
 * dev server never duplicates rows or overwrites user-created data.
 */
export function seedDatabase(db: DatabaseSync) {
  if (process.env.SEED === "false") return

  const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
  if (existing.n > 0) return

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, role, email, password_hash, avatar_initials, department, batch, semester, roll_no, mentor_id, designation, subjects)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const defaultPassword = hashPassword("campus123")
  const adminPassword = hashPassword(ADMIN_CREDS.password)

  for (const s of STUDENTS) {
    insertUser.run(
      s.id,
      s.name,
      s.role,
      s.email,
      defaultPassword,
      s.avatarInitials,
      s.department,
      s.batch ?? null,
      s.semester ?? null,
      s.rollNo ?? null,
      s.mentorId ?? null,
      null,
      null,
    )
  }

  for (const st of STAFF) {
    insertUser.run(
      st.id,
      st.name,
      st.role,
      st.email,
      defaultPassword,
      st.avatarInitials,
      st.department,
      null,
      null,
      null,
      null,
      st.designation ?? null,
      st.subjects ? JSON.stringify(st.subjects) : null,
    )
  }

  const admin = DEMO_USERS.admin
  insertUser.run(
    admin.id,
    admin.name,
    admin.role,
    ADMIN_CREDS.email,
    adminPassword,
    admin.avatarInitials,
    admin.department,
    null,
    null,
    null,
    null,
    admin.designation ?? null,
    null,
  )

  type SqlValue = string | number | null
  const insert = (sql: string, rows: SqlValue[][]) => {
    const stmt = db.prepare(sql)
    for (const row of rows) stmt.run(...row)
  }

  insert("INSERT INTO mentors (id,name,designation,department,email,phone,office,office_hours,avatar_initials,mentees) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    ...MENTORS.map((m) => [m.id, m.name, m.designation, m.department, m.email, m.phone, m.office, m.officeHours, m.avatarInitials, m.mentees]),
  ])

  insert("INSERT INTO notifications (id,title,body,time,category,unread) VALUES (?,?,?,?,?,?)", [
    ...NOTIFICATIONS.map((n) => [n.id, n.title, n.body, n.time, n.category, n.unread ? 1 : 0]),
  ])

  insert("INSERT INTO schedule_slots (id,day,start,end,module,code,room,staff) VALUES (?,?,?,?,?,?,?,?)", [
    ...SCHEDULE.map((s) => [s.id, s.day, s.start, s.end, s.module, s.code, s.room, s.staff]),
  ])

  const userByName = new Map(
    [...STUDENTS, ...STAFF, DEMO_USERS.admin].map((u) => [u.name, u.id]),
  )

  insert("INSERT INTO check_ins (id,user_id,name,role,time,status,method,device_id,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    ...CHECK_INS.map((c) => [
      c.id,
      userByName.get(c.name) ?? DEMO_USERS.student.id,
      c.name,
      c.role,
      c.time,
      c.status,
      c.method,
      null,
      "web",
      localDateTime(),
    ]),
  ])

  insert("INSERT INTO fee_items (id,student_id,name,amount,due_date,status,paid_date,method,receipt_id) VALUES (?,?,?,?,?,?,?,?,?)", [
    ...FEE_STRUCTURE.map((f) => [f.id, DEMO_USERS.student.id, f.name, f.amount, f.dueDate, f.status, f.paidDate ?? null, f.method ?? null, f.receiptId ?? null]),
  ])

  insert("INSERT INTO receipts (id,student_id,student_name,item_name,amount,date,method,transaction_id) VALUES (?,?,?,?,?,?,?,?)", [
    ...RECEIPTS.map((r) => [r.id, r.studentId, r.studentName, r.itemName, r.amount, r.date, r.method, r.transactionId]),
  ])

  insert("INSERT INTO assignments (id,module_code,module_name,title,description,assigned_date,due_date,max_marks) VALUES (?,?,?,?,?,?,?,?)", [
    ...ASSIGNMENTS.map((a) => [a.id, a.moduleCode, a.moduleName, a.title, a.description, a.assignedDate, a.dueDate, a.maxMarks]),
  ])

  insert("INSERT INTO submissions (id,assignment_id,student_id,student_name,submitted_at,file_name,marks,feedback) VALUES (?,?,?,?,?,?,?,?)", [
    ...SUBMISSIONS.map((s) => [s.id, s.assignmentId, s.studentId, s.studentName, s.submittedAt, s.fileName, s.marks, s.feedback]),
  ])

  insert("INSERT INTO exams (id,title,module_code,module_name,type,date,start,end,room,max_marks) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    ...EXAMINATIONS.map((e) => [e.id, e.title, e.moduleCode, e.moduleName, e.type, e.date, e.start, e.end, e.room, e.maxMarks]),
  ])

  insert("INSERT INTO results (id,exam_id,student_id,marks,max_marks) VALUES (?,?,?,?,?)", [
    ...RESULTS.map((r) => [r.id, r.examId, r.studentId, r.marks, r.maxMarks]),
  ])

  insert("INSERT INTO scholarships (id,name,provider,amount,eligibility,seats,deadline,description) VALUES (?,?,?,?,?,?,?,?)", [
    ...SCHOLARSHIPS.map((s) => [s.id, s.name, s.provider, s.amount, s.eligibility, s.seats, s.deadline, s.description]),
  ])

  insert("INSERT INTO scholarship_applications (id,scholarship_id,student_id,student_name,status,submitted_at,docs) VALUES (?,?,?,?,?,?,?)", [
    ...SCHOLARSHIP_APPLICATIONS.map((a) => [a.id, a.scholarshipId, a.studentId, a.studentName, a.status, a.submittedAt, JSON.stringify(a.docs)]),
  ])

  insert("INSERT INTO programs (id,name,duration,seats,deadline,fee) VALUES (?,?,?,?,?,?)", [
    ...PROGRAMS.map((p) => [p.id, p.name, p.duration, p.seats, p.deadline, p.fee]),
  ])

  insert("INSERT INTO admission_applications (id,applicant_name,email,program_id,program_name,score,docs,status,submitted_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    ...ADMISSION_APPLICATIONS.map((a) => [
      a.id,
      a.applicantName,
      a.email,
      a.programId,
      a.programName,
      a.score,
      JSON.stringify(a.docs),
      a.status,
      a.submittedAt,
      a.notes,
    ]),
  ])

  insert("INSERT INTO complaints (id,category,subject,description,status,created_at,raised_by_name,raised_by_role,raised_by_id,comments) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    ...COMPLAINTS.map((c) => [c.id, c.category, c.subject, c.description, c.status, c.createdAt, c.raisedByName, c.raisedByRole, null, JSON.stringify(c.comments)]),
  ])

  insert("INSERT INTO feedback_targets (id,type,name,subtitle) VALUES (?,?,?,?)", [
    ...FEEDBACK_TARGETS.map((t) => [t.id, t.type, t.name, t.subtitle]),
  ])

  insert("INSERT INTO feedback_entries (id,target_id,rating,comment,by_name,created_at) VALUES (?,?,?,?,?,?)", [
    ...FEEDBACK_ENTRIES.map((f) => [f.id, f.targetId, f.rating, f.comment, f.byName, f.createdAt]),
  ])
}
