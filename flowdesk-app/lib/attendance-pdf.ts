import PDFDocument from "pdfkit"

export type AttendancePdfRecord = {
  date: string
  time: string
  method: string
  status: "on-time" | "late" | "absent"
}

export type AttendancePdfData = {
  studentName: string
  studentId: string
  from: string
  to: string
  generatedAt: string
  records: AttendancePdfRecord[]
  summary: { total: number; present: number; late: number; absent: number; percentage: number }
}

const STATUS_TEXT: Record<AttendancePdfRecord["status"], string> = {
  "on-time": "Present",
  late: "Late",
  absent: "Absent",
}

export function buildAttendancePdf(data: AttendancePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const left = 56
    const right = doc.page.width - 56
    const colDate = left
    const colTime = left + 105
    const colMethod = left + 190
    const colStatus = right - 80

    doc.rect(0, 0, doc.page.width, 12).fill("#2a2d37")
    doc.moveDown(4)

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#15151f").text("FlowDesk", { continued: true })
    doc.font("Helvetica").fontSize(11).fillColor("#6b7280").text("  — Attendance history")
    doc.moveDown(0.2)
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(`Generated on ${data.generatedAt}`)

    doc.moveDown(1.4)
    const field = (label: string, value: string, baseline: number) => {
      doc.font("Helvetica").fontSize(8.5).fillColor("#9ca3af").text(label.toUpperCase(), left, baseline)
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1c1c2e").text(value, left, baseline + 12)
    }

    const y0 = doc.y
    field("Student", data.studentName, y0)
    field("Record ID", data.studentId, y0 + 34)
    field("Date range", `${data.from} — ${data.to}`, y0 + 68)

    doc.y = y0 + 118
    doc.moveDown(0.6)
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke()

    doc.moveDown(1)
    let rowY = doc.y

    doc.font("Helvetica").fontSize(9).fillColor("#6b7280")
    doc.text("DATE", colDate, rowY)
    doc.text("TIME", colTime, rowY, { width: 80 })
    doc.text("METHOD", colMethod, rowY, { width: 90 })
    doc.text("STATUS", colStatus, rowY, { width: 70 })

    rowY += 20
    doc.moveTo(left, rowY).lineTo(right, rowY).strokeColor("#e5e7eb").lineWidth(1).stroke()
    rowY += 8

    doc.font("Helvetica").fontSize(10).fillColor("#1c1c2e")
    for (const r of data.records) {
      if (rowY > doc.page.height - 70) {
        doc.addPage()
        rowY = 56
      }
      doc.text(r.date, colDate, rowY)
      doc.text(r.time, colTime, rowY, { width: 80 })
      doc.text(r.method.charAt(0).toUpperCase() + r.method.slice(1), colMethod, rowY, { width: 90 })
      doc.text(STATUS_TEXT[r.status], colStatus, rowY, { width: 70 })
      rowY += 18
    }

    const sumY = rowY + 12
    doc.moveTo(left, sumY - 6).dash(2, 2).lineTo(right, sumY - 6).strokeColor("#d1d5db").stroke().undash()
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1c1c2e").text("Summary", left, sumY)
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(
      `${data.summary.total} total · ${data.summary.present} present · ${data.summary.late} late · ${data.summary.absent} absent · ${data.summary.percentage}% attendance`,
      left,
      sumY + 16,
      { width: right - left },
    )

    doc.font("Helvetica").fontSize(8.5).fillColor("#9ca3af").text(
      "This is a digitally generated attendance history from FlowDesk for the student and date range above.",
      left,
      sumY + 44,
      { width: right - left },
    )

    doc.end()
  })
}