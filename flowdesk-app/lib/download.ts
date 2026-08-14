/**
 * Builds a small self-contained HTML document and triggers a download.
 * Used for digital report cards and payment receipts (no PDF dependency).
 */
export function downloadHtml(filename: string, title: string, body: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;max-width:720px;margin:36px auto;padding:0 24px;color:#1c1c2e;line-height:1.5}
  h1{font-size:20px;margin:0}
  h2{font-size:15px;margin:0 0 12px}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2563eb;padding-bottom:14px;margin-bottom:20px}
  .muted{color:#6b7280;font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:14px 0}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
  th,td{padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
  .right{text-align:right}
  .total{background:#f3f4f6;font-weight:700}
  .badge{display:inline-block;padding:3px 12px;border-radius:999px;background:#dbeafe;color:#2563eb;font-weight:700;font-size:12px}
  .note{font-size:12px;color:#9ca3af;margin-top:22px;border-top:1px dashed #d1d5db;padding-top:10px}
</style>
</head>
<body>${body}</body>
</html>`
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
