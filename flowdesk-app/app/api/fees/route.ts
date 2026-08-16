import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const feeRows = db
    .prepare("SELECT id, name, amount, due_date, status, paid_date, method, receipt_id FROM fee_items WHERE student_id = ?")
    .all(user.id) as {
    id: string
    name: string
    amount: number
    due_date: string
    status: "paid" | "pending"
    paid_date: string | null
    method: string | null
    receipt_id: string | null
  }[]

  const receiptRows = db
    .prepare("SELECT id, student_id, student_name, item_name, amount, date, method, transaction_id FROM receipts WHERE student_id = ?")
    .all(user.id) as {
    id: string
    student_id: string
    student_name: string
    item_name: string
    amount: number
    date: string
    method: string
    transaction_id: string
  }[]

  const feeStructure = feeRows.map((f) => ({
    id: f.id,
    name: f.name,
    amount: f.amount,
    dueDate: f.due_date,
    status: f.status,
    paidDate: f.paid_date ?? undefined,
    method: f.method ?? undefined,
    receiptId: f.receipt_id ?? undefined,
  }))

  const receipts = receiptRows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    itemName: r.item_name,
    amount: r.amount,
    date: r.date,
    method: r.method,
    transactionId: r.transaction_id,
  }))

  const paid = feeStructure.filter((f) => f.status === "paid")
  const pending = feeStructure.filter((f) => f.status === "pending")
  const total = feeStructure.reduce((sum, f) => sum + f.amount, 0)

  return NextResponse.json({
    feeStructure,
    receipts,
    summary: {
      total,
      paid: paid.reduce((sum, f) => sum + f.amount, 0),
      pending: pending.reduce((sum, f) => sum + f.amount, 0),
      pendingCount: pending.length,
    },
  })
}
