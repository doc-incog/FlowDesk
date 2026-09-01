//! Minimal, dependency-free PDF writer for fee receipts and report cards.
//!
//! The migrated backend needed to replace the Next.js `pdfkit` routes
//! (`receipt-pdf`, `report-card-pdf`). Rather than pull in a PDF crate with a
//! shifting API, these documents are pure text plus a header bar, so we emit a
//! valid single-page PDF using the built-in Helvetica Type1 fonts (no font
//! files, no shaping libraries). Output is deterministic and verifies to open.

use std::collections::BTreeMap;

use crate::error::ApiError;

const PAGE_W: f64 = 595.0; // A4 width in points
const PAGE_H: f64 = 842.0; // A4 height in points
const MARGIN: f64 = 56.0; // mm

/// A positioned line of body text.
struct TextLine {
    text: String,
    x: f64, // mm from left edge
    y: f64, // baseline height from top edge (mm)
    bold: bool,
    size: f64,
    is_header: bool,
}

fn pt(mm: f64) -> f64 {
    mm * 2.834_645_669
}

/// Escape a string for a PDF literal (parentheses/backslash escape; keep ASCII; UTF-8->Latin-1ish bytes).
fn esc(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '(' | ')' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            c if (c as u32) < 0x80 => out.push(c),
            c => {
                let cp = c as u32;
                if cp <= 0x7ff {
                    out.push((0xc0 | (cp >> 6)) as u8 as char);
                    out.push((0x80 | (cp & 0x3f)) as u8 as char);
                } else if cp <= 0xffff {
                    out.push((0xe0 | (cp >> 12)) as u8 as char);
                    out.push((0x80 | ((cp >> 6) & 0x3f)) as u8 as char);
                    out.push((0x80 | (cp & 0x3f)) as u8 as char);
                } else {
                    out.push('?');
                }
            }
        }
    }
    out
}

fn build_pdf(lines: &[TextLine], bar_mm: f64, title: &str) -> Result<Vec<u8>, ApiError> {
    let mut content = String::new();

    // Dark top header stripe.
    if bar_mm > 0.0 {
        content.push_str(&format!(
            "q 0.086 0.09 0.11 rg 0 {} {} {} re f Q\n",
            pt(bar_mm),
            pt(PAGE_W),
            pt(PAGE_H - bar_mm),
        ));
    }

    for l in lines {
        let font = if l.bold { "/F2" } else { "/F1" };
        let (r, g, b) = if l.is_header {
            (0.086, 0.09, 0.11)
        } else {
            (0.15, 0.16, 0.19)
        };
        let x = pt(l.x);
        let y = PAGE_H - pt(l.y); // baseline from top -> from bottom
        content.push_str(&format!(
            "{} {} {} rg BT {} {} Tf {} {} Td ({}) Tj ET\n",
            r,
            g,
            b,
            font,
            l.size,
            x,
            y,
            esc(&l.text),
        ));
    }

    assemble(&content, title)
}

fn assemble(content: &str, title: &str) -> Result<Vec<u8>, ApiError> {
    let stream_len = content.len();
    let mut objs: Vec<String> = Vec::new();
    // We build object strings up front; they are written later, so font object
    // numbers are known.
    let mut fonts: BTreeMap<String, &str> = BTreeMap::new();
    fonts.insert("F1".into(), "Helvetica");
    fonts.insert("F2".into(), "Helvetica-Bold");
    let n_fonts = fonts.len();
    let font_obj_base = 5;

    // 1 Catalog, 2 Pages, 3 Page, 4 Content, then fonts, then Info.
    let mut font_dict = String::new();
    let mut i = font_obj_base;
    for name in fonts.keys() {
        font_dict.push_str(&format!("/{} {} 0 R ", name, i));
        i += 1;
    }

    objs.push("<< /Type /Catalog /Pages 2 0 R >>".into()); // 1
    objs.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into()); // 2
    objs.push(format!( // 3
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /Font << {} >> >> /Contents 4 0 R >>",
        PAGE_W, PAGE_H, font_dict
    ));
    objs.push(format!("<< /Length {} >>\nstream\n{}\nendstream", stream_len, content)); // 4
    for (_, basefont) in &fonts {
        objs.push(format!(
            "<< /Type /Font /Subtype /Type1 /BaseFont /{} /Encoding /WinAnsiEncoding >>",
            basefont
        ));
    }
    objs.push(format!("<< /Title ({}) /Producer (FlowDesk Backend) >>", title)); // Info (last)

    let n_objs = objs.len();
    let _ = n_fonts;

    let mut out: Vec<u8> = Vec::new();
    out.extend_from_slice(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

    let mut offsets: Vec<usize> = Vec::with_capacity(n_objs);
    for (idx, obj) in objs.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", idx + 1, obj).as_bytes());
    }

    // xref
    let xref_pos = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n", n_objs + 1).as_bytes());
    out.extend_from_slice(b"0000000000 65535 f \n");
    for off in &offsets {
        out.extend_from_slice(format!("{:010} 00000 n \n", off).as_bytes());
    }
    out.extend_from_slice(format!(
        "trailer\n<< /Size {} /Root 1 0 R /Info {} 0 R >>\nstartxref\n{}\n%%EOF\n",
        n_objs + 1,
        n_objs,
        xref_pos
    )
    .as_bytes());

    Ok(out)
}

// ---- Public high-level builders ----------------------------------------------

pub struct ReceiptSpec {
    pub id: String,
    pub student_name: String,
    pub student_id: String,
    pub item_name: String,
    pub amount: f64,
    pub method: String,
    pub transaction_id: String,
    pub date: String,
}

pub fn receipt_pdf(spec: &ReceiptSpec) -> Result<Vec<u8>, ApiError> {
    let mut lines = Vec::new();
    lines.push(TextLine { text: "FlowDesk".into(), x: MARGIN, y: 775.0, bold: true, size: 20.0, is_header: true });
    lines.push(TextLine { text: " — Payment receipt".into(), x: MARGIN + 92.0, y: 775.0, bold: false, size: 11.0, is_header: true });
    lines.push(TextLine { text: String::new(), x: MARGIN, y: 745.0, bold: false, size: 8.0, is_header: false });

    let rows = [
        ("Receipt", spec.id.clone()),
        ("Student", spec.student_name.clone()),
        ("Student ID", spec.student_id.clone()),
        ("Item", spec.item_name.clone()),
        ("Amount", format!("₹{:.2}", spec.amount)),
        ("Method", spec.method.clone()),
        ("Txn ID", spec.transaction_id.clone()),
        ("Date", spec.date.clone()),
    ];
    let mut y = 720.0;
    for (k, v) in rows {
        lines.push(TextLine { text: k.into(), x: MARGIN, y, bold: true, size: 11.0, is_header: false });
        lines.push(TextLine { text: v, x: MARGIN + 110.0, y, bold: false, size: 11.0, is_header: false });
        y -= 20.0;
    }

    build_pdf(&lines, 12.0, &format!("Receipt {}", spec.id))
}

pub struct ReportCardSpec {
    pub student_name: String,
    pub student_id: String,
    pub semester: String,
    pub department: String,
    pub rows: Vec<(String, f64, f64, String)>, // moduleCode, max, marks, grade
    pub total_max: f64,
    pub total_marks: f64,
    pub overall: f64,
    pub grade: String,
}

pub fn report_card_pdf(spec: &ReportCardSpec) -> Result<Vec<u8>, ApiError> {
    let mut lines = Vec::new();
    lines.push(TextLine { text: "FlowDesk".into(), x: MARGIN, y: 775.0, bold: true, size: 20.0, is_header: true });
    lines.push(TextLine { text: " — Digital report card".into(), x: MARGIN + 92.0, y: 775.0, bold: false, size: 11.0, is_header: true });
    lines.push(TextLine { text: format!("Semester     {}", spec.semester), x: MARGIN, y: 745.0, bold: false, size: 10.0, is_header: false });
    lines.push(TextLine { text: format!("Student      {} ({})", spec.student_name, spec.student_id), x: MARGIN, y: 727.0, bold: false, size: 10.0, is_header: false });
    lines.push(TextLine { text: format!("Department   {}", spec.department), x: MARGIN, y: 709.0, bold: false, size: 10.0, is_header: false });

    // Table header
    let hx: [(&str, f64, bool); 4] = [("Subject", MARGIN, true), ("Max", MARGIN + 200.0, true), ("Marks", MARGIN + 240.0, true), ("Grade", MARGIN + 285.0, true)];
    for (t, x, bold) in hx {
        lines.push(TextLine { text: t.into(), x, y: 678.0, bold, size: 11.0, is_header: false });
    }

    let mut y = 656.0;
    for (modcode, max, marks, grade) in &spec.rows {
        if y < 90.0 {
            break;
        }
        lines.push(TextLine { text: modcode.clone(), x: MARGIN, y, bold: false, size: 11.0, is_header: false });
        lines.push(TextLine { text: format!("{}", max), x: MARGIN + 200.0, y, bold: false, size: 11.0, is_header: false });
        lines.push(TextLine { text: format!("{}", marks), x: MARGIN + 240.0, y, bold: false, size: 11.0, is_header: false });
        lines.push(TextLine { text: grade.clone(), x: MARGIN + 285.0, y, bold: false, size: 11.0, is_header: false });
        y -= 17.0;
    }

    lines.push(TextLine { text: format!("Total: {}/{}", spec.total_marks, spec.total_max), x: MARGIN, y: y - 10.0, bold: true, size: 11.0, is_header: false });
    lines.push(TextLine { text: format!("Overall: {:.1}%  Grade: {}", spec.overall, spec.grade), x: MARGIN + 160.0, y: y - 10.0, bold: true, size: 11.0, is_header: false });

    build_pdf(&lines, 12.0, &format!("Report card {}", spec.student_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn receipt_pdf_is_well_formed() {
        let spec = ReceiptSpec {
            id: "RC-TEST-1".into(),
            student_name: "Aisha Karim".into(),
            student_id: "STU-2043".into(),
            item_name: "Tuition Fee".into(),
            amount: 50000.0,
            method: "card".into(),
            transaction_id: "TXN-100".into(),
            date: "02 Sep 2026".into(),
        };
        let bytes = receipt_pdf(&spec).expect("receipt pdf builds");
        assert!(bytes.starts_with(b"%PDF-1.4"), "valid PDF header");
        assert!(bytes.windows(6).any(|w| w == b"startx"), "has startxref");
        assert!(bytes.windows(5).any(|w| w == b"%%EOF"), "has EOF mark");
        // startxref points at the correct "xref" token.
        let hay = String::from_utf8_lossy(&bytes);
        let sx = hay.rfind("startxref").unwrap();
        let num = hay[sx + "startxref".len()..].trim();
        let pos: usize = num.split_whitespace().next().unwrap().parse().unwrap();
        let real = bytes.windows(4).position(|w| w == b"xref").unwrap();
        assert_eq!(pos, real, "startxref offset matches xref position");
    }

    #[test]
    fn content_includes_text() {
        let spec = ReportCardSpec {
            student_name: "Liam Wong".into(),
            student_id: "STU-2047".into(),
            semester: "Sem 3".into(),
            department: "B.Tech CS".into(),
            rows: vec![("CS301".into(), 100.0, 88.0, "A".into())],
            total_max: 100.0,
            total_marks: 88.0,
            overall: 88.0,
            grade: "A".into(),
        };
        let bytes = report_card_pdf(&spec).expect("report card builds");
        assert!(bytes.starts_with(b"%PDF"));
        assert!(String::from_utf8_lossy(&bytes).contains("Liam Wong"));
    }
}