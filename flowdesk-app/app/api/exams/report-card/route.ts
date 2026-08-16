import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { buildReportCardPdf, type ReportCardData } from "@/lib/report-card-pdf"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: ReportCardData
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body?.studentName || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "Missing report card data" }, { status: 400 })
  }

  const pdf = await buildReportCardPdf(body)

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-card-${body.studentId ?? "student"}.pdf"`,
    },
  })
}
