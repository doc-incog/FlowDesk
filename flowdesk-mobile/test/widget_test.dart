// Basic Flutter widget test.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Smoke test builds a widget tree', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('FlowDesk'))));
    expect(find.text('FlowDesk'), findsOneWidget);
  });
}