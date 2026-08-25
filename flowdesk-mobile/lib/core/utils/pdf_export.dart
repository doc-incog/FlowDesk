import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '_share_native.dart' if (dart.library.html) '_share_web.dart';

import 'format.dart';
import 'grades.dart';

class ReportCardEntry {
  const ReportCardEntry({
    required this.moduleName,
    required this.moduleCode,
    required this.maxMarks,
    required this.marks,
  });

  final String moduleName;
  final String moduleCode;
  final int maxMarks;
  final int marks;
}

class ReportCardData {
  const ReportCardData({
    required this.studentName,
    required this.rollNo,
    required this.department,
    required this.semester,
    required this.entries,
  });

  final String studentName;
  final String rollNo;
  final String department;
  final String semester;
  final List<ReportCardEntry> entries;

  int get totalMarks => entries.fold(0, (a, e) => a + e.marks);
  int get totalMax => entries.fold(0, (a, e) => a + e.maxMarks);
  double get overallPercent => totalMax == 0 ? 0 : (totalMarks / totalMax) * 100;
}

class ReceiptData {
  const ReceiptData({
    required this.receiptId,
    required this.studentName,
    required this.rollNo,
    required this.transactionId,
    required this.itemName,
    required this.amount,
    required this.date,
    required this.methodLabel,
  });

  final String receiptId;
  final String studentName;
  final String rollNo;
  final String transactionId;
  final String itemName;
  final int amount;
  final String date;
  final String methodLabel;
}

const _accent = PdfColor.fromInt(0xFFba2c25);

pw.Widget _header(pw.Context context, String docType) {
  return pw.Column(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.Container(
        padding: const pw.EdgeInsets.fromLTRB(0, 0, 0, 10),
        decoration: const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: _accent, width: 3)),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text('FlowDesk — $docType',
                style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
            pw.Text('Semester 5 · Academic Year 2025–26',
                style: pw.TextStyle(color: PdfColors.grey600, fontSize: 12)),
          ],
        ),
      ),
      pw.SizedBox(height: 14),
    ],
  );
}

pw.Widget _labelGrid(List<(String, String)> rows) {
  return pw.Column(
    children: [
      for (final (label, value) in rows)
        pw.Padding(
          padding: const pw.EdgeInsets.symmetric(vertical: 3),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(label, style: pw.TextStyle(color: PdfColors.grey600, fontSize: 12)),
              pw.Text(value, style: const pw.TextStyle(fontSize: 12)),
            ],
          ),
        ),
    ],
  );
}

pw.Widget _note(String text) {
  return pw.Padding(
    padding: const pw.EdgeInsets.only(top: 22),
    child: pw.Container(
      padding: const pw.EdgeInsets.only(top: 10),
      decoration: const pw.BoxDecoration(
        border: pw.Border(top: pw.BorderSide(color: PdfColors.grey400, style: pw.BorderStyle.dashed)),
      ),
      child: pw.Text(text, style: pw.TextStyle(color: PdfColors.grey500, fontSize: 11)),
    ),
  );
}

Future<void> exportReportCard(ReportCardData data) async {
  final doc = pw.Document();

  doc.addPage(pw.MultiPage(
    margin: const pw.EdgeInsets.all(40),
    build: (context) => [
      _header(context, 'Digital Report Card'),
      pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: pw.BoxDecoration(
              color: _accent,
              borderRadius: pw.BorderRadius.circular(20),
            ),
            child: pw.Text('${data.overallPercent.round()}%',
                style: const pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold)),
          ),
        ],
      ),
      pw.SizedBox(height: 14),
      _labelGrid([
        ('Student name', data.studentName),
        ('Roll no', data.rollNo),
        ('Department', data.department),
        ('Semester', data.semester),
      ]),
      pw.SizedBox(height: 14),
      pw.TableHelper.fromTextArray(
        headers: ['Exam', 'Module', 'Max', 'Marks', '%', 'Grade'],
        data: [
          for (final e in data.entries)
            [
              e.moduleCode,
              e.moduleName,
              '${e.maxMarks}',
              '${e.marks}',
              '${(e.marks / e.maxMarks * 100).round()}',
              gradeFor((e.marks / e.maxMarks * 100).round()),
            ],
        ],
        headerStyle: pw.TextStyle(
            fontSize: 10,
            color: PdfColors.grey600,
            fontWeight: pw.FontWeight.bold),
        cellStyle: const pw.TextStyle(fontSize: 12),
        cellPadding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
        headerDecoration: const pw.BoxDecoration(
          color: PdfColor.fromInt(0xFFf3f4f6),
          border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey400)),
        ),
        cellDecoration: (index, data, rowNum) => const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300)),
        ),
        columnWidths: {
          0: const pw.FixedColumnWidth(70),
          1: const pw.FlexColumnWidth(),
          2: const pw.FixedColumnWidth(50),
          3: const pw.FixedColumnWidth(55),
          4: const pw.FixedColumnWidth(45),
          5: const pw.FixedColumnWidth(50),
        },
      ),
      pw.SizedBox(height: 10),
      pw.Container(
        padding: const pw.EdgeInsets.all(10),
        color: const PdfColor.fromInt(0xFFf3f4f6),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('Total', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
            pw.Text('${data.totalMarks} / ${data.totalMax}  (${data.overallPercent.round()}%)',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ],
        ),
      ),
      _note('Marks are auto-calculated from the registered examination results. '
          'This document is generated by FlowDesk and does not require a physical copy.'),
    ],
  ));

  await _share(doc, 'report-card-${data.rollNo}.pdf', 'Report Card');
}

Future<void> exportReceipt(ReceiptData data) async {
  final doc = pw.Document();

  doc.addPage(pw.MultiPage(
    margin: const pw.EdgeInsets.all(40),
    build: (context) => [
      _header(context, 'Fee Receipt'),
      pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(data.date, style: const pw.TextStyle(fontSize: 12)),
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: pw.BoxDecoration(
              color: PdfColors.green,
              borderRadius: pw.BorderRadius.circular(20),
            ),
            child: pw.Text('PAID',
                style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold)),
          ),
        ],
      ),
      pw.SizedBox(height: 14),
      _labelGrid([
        ('Receipt no', data.receiptId),
        ('Student', data.studentName),
        ('Roll no', data.rollNo),
        ('Transaction id', data.transactionId),
      ]),
      pw.SizedBox(height: 14),
      pw.TableHelper.fromTextArray(
        headers: ['Description', 'Amount'],
        data: [
          [data.itemName, formatINR(data.amount)],
        ],
        headerStyle: pw.TextStyle(
            fontSize: 10,
            color: PdfColors.grey600,
            fontWeight: pw.FontWeight.bold),
        cellStyle: const pw.TextStyle(fontSize: 12),
        cellPadding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        headerDecoration: const pw.BoxDecoration(
          color: PdfColor.fromInt(0xFFf3f4f6),
          border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey400)),
        ),
        cellDecoration: (index, data, rowNum) => const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300)),
        ),
      ),
      pw.SizedBox(height: 10),
      pw.Container(
        padding: const pw.EdgeInsets.all(10),
        color: const PdfColor.fromInt(0xFFf3f4f6),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('Total paid via ${data.methodLabel}',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
            pw.Text(formatINR(data.amount), style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ],
        ),
      ),
      _note('This is a system-generated receipt. No physical copy is required.'),
    ],
  ));

  await _share(doc, 'receipt-${data.receiptId}.pdf', 'Fee Receipt');
}

Future<void> _share(pw.Document doc, String fileName, String subject) async {
  await sharePdf(doc, fileName, subject);
}
