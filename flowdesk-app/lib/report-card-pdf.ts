import PDFDocument from "pdfkit"

export type ReportCardRow = {
  title: string
  moduleCode: string
  max: number
  marks: number
  pct: number
  grade: string
}

export type ReportCardData = {
  studentName: string
  studentId: string
  rollNo: string
  department: string
  semester: string
  rows: ReportCardRow[]
  totalMax: number
  totalMarks: number
  overall: number
  grade: string
}

export function buildReportCardPdf(data: ReportCardData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.rect(0, 0, doc.page.width, 12).fill("#2a2d37")
    doc.moveDown(4)

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#15151f").text("FlowDesk", { continued: true })
    doc.font("Helvetica").fontSize(11).fillColor("#6b7280").text("  — Digital report card")
    doc.moveDown(0.2)
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(`${data.semester} · Academic Year 2025–26`)

    doc.moveDown(1.4)
    const y0 = doc.y
    const field = (label: string, value: string, baseline: number) => {
      doc.font("Helvetica").fontSize(8.5).fillColor("#9ca3af").text(label.toUpperCase(), 56, baseline)
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1c1c2e").text(value, 56, baseline + 12)
    }
    field("Student", data.studentName, y0)
    field("Roll no", data.rollNo, y0)
    field("Department", data.department, y0 + 46)
    field("Semester", data.semester, y0 + 46)
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#2a2d37").text(`Overall grade: ${data.grade}`, doc.page.width - 200, y0)

    doc.y = y0 + 96
    doc.moveDown(0.6)
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).strokeColor("#e5e7eb").lineWidth(1).stroke()

    doc.moveDown(1)
    const headY = doc.y
    const cols = [
      { label: "EXAM", x: 56 },
      { label: "MODULE", x: 200 },
      { label: "MAX", x: 360, right: true },
      { label: "MARKS", x: 420, right: true },
      { label: "%", x: 470, right: true },
      { label: "GRADE", x: doc.page.width - 120, right: true },
    ]
    cols.forEach((c) => {
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280")
      if (c.right) doc.text(c.label, c.x, headY, { width: 56, align: "right" })
      else doc.text(c.label, c.x, headY)
    })

    let y = headY + 24
    data.rows.forEach((r) => {
      doc.font("Helvetica").fontSize(10).fillColor("#1c1c2e")
      doc.text(r.title.slice(0, 18), 56, y)
      doc.text(r.moduleCode, 200, y)
      doc.text(String(r.max), 360, y, { width: 56, align: "right" })
      doc.text(String(r.marks), 420, y, { width: 56, align: "right" })
      doc.text(`${r.pct}%`, 470, y, { width: 56, align: "right" })
      doc.text(r.grade, doc.page.width - 120, y, { width: 56, align: "right" })
      y += 22
    })

    doc.moveDown(0.4)
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).strokeColor("#e5e7eb").stroke()
    doc.moveDown(0.4)
    const totalY = doc.y
    doc.font("Helvetica").fontSize(10).fillColor("#1c1c2e").text("Total", 56, totalY)
    doc.text(String(data.totalMax), 360, totalY, { width: 56, align: "right" })
    doc.text(String(data.totalMarks), 420, totalY, { width: 56, align: "right" })
    doc.text(`${data.overall}%`, 470, totalY, { width: 56, align: "right" })
    doc.font("Helvetica-Bold").text(data.grade, doc.page.width - 120, totalY, { width: 56, align: "right" })

    doc.moveDown(2)
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).dash(2, 2).strokeColor("#d1d5db").stroke().undash()
    doc.moveDown(0.8)
    doc.font("Helvetica").fontSize(8.5).fillColor("#9ca3af").text(
      "This is a digitally generated report card from FlowDesk. Marks are auto-calculated from entered examination results.",
      56,
      doc.y,
      { width: doc.page.width - 112 },
    )

    doc.end()
  })
}
