import PDFDocument from "pdfkit"

export type ReceiptPdfData = {
  id: string
  studentName: string
  studentId: string
  itemName: string
  amount: number
  date: string
  method: string
  transactionId: string
}

export function formatNPR(n: number): string {
  return `Rs. ${n.toLocaleString("en-NP")}`
}

export function buildReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.rect(0, 0, doc.page.width, 12).fill("#2a2d37")
    doc.moveDown(4)

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#15151f").text("FlowDesk", { continued: true })
    doc.font("Helvetica").fontSize(11).fillColor("#6b7280").text("  — Fee receipt")
    doc.moveDown(0.2)
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(`Generated on ${data.date}`)

    doc.moveDown(1.6)
    doc
      .roundedRect(56, doc.y, doc.page.width - 112, 26, 13)
      .fillAndStroke("#eef2f7", "#eef2f7")
    doc.fillColor("#1c1c2e").font("Helvetica-Bold").fontSize(11).text("PAID", 56 + 14, doc.y + 7)

    doc.moveDown(2)
    doc.y -= 4

    const left = 56
    const right = doc.page.width - 56
    const labelX = left

    const field = (label: string, value: string, baseline: number) => {
      doc.font("Helvetica").fontSize(8.5).fillColor("#9ca3af").text(label.toUpperCase(), labelX, baseline)
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1c1c2e").text(value, labelX, baseline + 12)
    }

    doc.y += 10
    const y0 = doc.y
    field("Receipt no", data.id, y0)
    field("Student", data.studentName, y0)
    field("Roll no", data.studentId, y0 + 46)
    field("Transaction", data.transactionId, y0 + 46)

    doc.y = y0 + 110
    doc.moveDown(0.6)
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke()

    doc.moveDown(1)
    const rowY = doc.y
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("DESCRIPTION", left, rowY)
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("AMOUNT", right - 90, rowY)
    doc.moveDown(1.4)
    const itemY = doc.y
    doc.font("Helvetica").fontSize(11).fillColor("#1c1c2e").text(data.itemName, left, itemY)
    doc.font("Helvetica-Bold").fontSize(11).text(formatNPR(data.amount), right - 90, itemY)
    doc.moveDown(1.6)
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#e5e7eb")
      .stroke()
    doc.moveDown(0.4)
    const totalY = doc.y
    doc.font("Helvetica").fontSize(10).fillColor("#1c1c2e").text(`Total paid via ${data.method}`, left, totalY)
    doc.font("Helvetica-Bold").text(formatNPR(data.amount), right - 90, totalY)

    doc.moveDown(2.4)
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .dash(2, 2)
      .strokeColor("#d1d5db")
      .stroke()
      .undash()
    doc.moveDown(0.8)
    doc.font("Helvetica").fontSize(8.5).fillColor("#9ca3af").text(
      "This is a digitally generated receipt from FlowDesk for the transaction above. No physical copy is required.",
      left,
      doc.y,
      { width: right - left },
    )

    doc.end()
  })
}
