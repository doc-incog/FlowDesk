import 'dart:js_interop';
import 'package:web/web.dart' as web;

import 'package:pdf/widgets.dart' as pw;

Future<void> sharePdf(pw.Document doc, String fileName, String subject) async {
  final bytes = await doc.save();
  final blob = web.Blob(
    [bytes.toJS].toJS,
    web.BlobPropertyBag(type: 'application/pdf'),
  );
  final url = web.URL.createObjectURL(blob);
  web.HTMLAnchorElement()
    ..href = url
    ..download = fileName
    ..click();
  web.URL.revokeObjectURL(url);
}
