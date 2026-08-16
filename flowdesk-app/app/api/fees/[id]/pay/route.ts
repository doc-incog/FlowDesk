import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

const METHODS = new Set(["upi", "card", "netbanking", "cash"])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  let body: { method?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const method = body.method ?? "upi"
  if (!METHODS.has(method)) {
    return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 })
  }

  const db = getDb()
  const fee = db
    .prepare("SELECT id, name, amount, status FROM fee_items WHERE id = ? AND student_id = ?")
    .get(id, user.id) as
    | { id: string; name: string; amount: number; status: string }
    | undefined

  if (!fee) return NextResponse.json({ error: "Fee item not found" }, { status: 404 })

  // Idempotent: already-paid items return the existing receipt instead of double-charging.
  if (fee.status === "paid") {
    const existing = db
      .prepare("SELECT id, student_id, student_name, item_name, amount, date, method, transaction_id FROM receipts WHERE student_id = ? AND item_name = ? ORDER BY date DESC LIMIT 1")
      .get(user.id, fee.name) as
      | {
          id: string
          student_id: string
          student_name: string
          item_name: string
          amount: number
          date: string
          method: string
          transaction_id: string
        }
      | undefined
    if (existing) {
      return NextResponse.json({ receipt: mapReceipt(existing), alreadyPaid: true })
    }
  }

  const now = new Date()
  const receiptId = `RCP-${now.getTime()}`
  const transactionId = `TXN-${now.getTime().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`
  const date = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })

  db.prepare(
    `INSERT INTO receipts (id, student_id, student_name, item_name, amount, date, method, transaction_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(receiptId, user.id, user.name, fee.name, fee.amount, date, method, transactionId)

  db.prepare(
    "UPDATE fee_items SET status = 'paid', paid_date = ?, method = ?, receipt_id = ? WHERE id = ?",
  ).run(date, method, receiptId, fee.id)

  const receipt = {
    id: receiptId,
    studentId: user.id,
    studentName: user.name,
    itemName: fee.name,
    amount: fee.amount,
    date,
    method,
    transactionId,
  }

  return NextResponse.json({ receipt, alreadyPaid: false }, { status: 201 })
}

function mapReceipt(r: {
  id: string
  student_id: string
  student_name: string
  item_name: string
  amount: number
  date: string
  method: string
  transaction_id: string
}) {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    itemName: r.item_name,
    amount: r.amount,
    date: r.date,
    method: r.method,
    transactionId: r.transaction_id,
  }
}
