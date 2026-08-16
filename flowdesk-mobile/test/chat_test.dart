import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/core/utils/chat.dart';
import 'package:flowdesk_mobile/data/chat_data.dart';

void main() {
  group('answerFor', () {
    test('matches keywords case-insensitively', () {
      final answer = answerFor('How do I PAY my semester fee?');
      expect(answer, contains('Online Fees'));
    });

    test('answers admissions queries', () {
      final answer = answerFor('Tell me about admissions and applying');
      expect(answer, contains('Admissions'));
    });

    test('answers library queries', () {
      final answer = answerFor('When does the library open?');
      expect(answer, contains('8:00 AM'));
    });

    test('returns fallback for unrecognised messages', () {
      expect(answerFor('what is the meaning of life?'), chatFallback);
    });
  });
}
