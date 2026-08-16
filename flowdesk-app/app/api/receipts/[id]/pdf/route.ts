import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { buildReceiptPdf } from "@/lib/receipt-pdf"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = getDb()
  const row = db
    .prepare(
      "SELECT id, student_id, student_name, item_name, amount, date, method, transaction_id FROM receipts WHERE id = ?",
    )
    .get(id) as
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

  if (!row || (user.role === "student" && row.student_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const methodLabel: Record<string, string> = {
    upi: "UPI",
    card: "Card",
    netbanking: "Net Banking",
    cash: "Cash",
  }

  const pdf = await buildReceiptPdf({
    id: row.id,
    studentName: row.student_name,
    studentId: row.student_id,
    itemName: row.item_name,
    amount: row.amount,
    date: row.date,
    method: methodLabel[row.method] ?? row.method,
    transactionId: row.transaction_id,
  })

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${row.id}.pdf"`,
    },
  })
}
