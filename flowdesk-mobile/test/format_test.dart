import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/core/utils/format.dart';

void main() {
  group('formatINR', () {
    test('groups in Indian numbering (en-IN)', () {
      expect(formatINR(0), '₹0');
      expect(formatINR(5), '₹5');
      expect(formatINR(999), '₹999');
      expect(formatINR(1000), '₹1,000');
      expect(formatINR(100000), '₹1,00,000');
      expect(formatINR(1000000), '₹10,00,000');
      expect(formatINR(100000000), '₹10,00,00,000');
      expect(formatINR(123456789), '₹12,34,56,789');
    });

    test('handles negatives', () {
      expect(formatINR(-2500), '-₹2,500');
    });
  });

  group('formatDate', () {
    test('formats as DD Mon YYYY', () {
      expect(formatDate(DateTime(2026, 8, 2)), '02 Aug 2026');
      expect(formatDate(DateTime(2026, 12, 31)), '31 Dec 2026');
      expect(formatDate(DateTime(2026, 1, 1)), '01 Jan 2026');
    });
  });

  group('formatTime', () {
    test('uses 12h clock with AM/PM', () {
      expect(formatTime(DateTime(2026, 1, 1, 9, 5)), '9:05 AM');
      expect(formatTime(DateTime(2026, 1, 1, 14, 30)), '2:30 PM');
      expect(formatTime(DateTime(2026, 1, 1, 0, 0)), '12:00 AM');
      expect(formatTime(DateTime(2026, 1, 1, 12, 0)), '12:00 PM');
    });
  });

  group('minutesOfDay', () {
    test('converts HH:MM to minutes since midnight', () {
      expect(minutesOfDay('00:00'), 0);
      expect(minutesOfDay('09:30'), 570);
      expect(minutesOfDay('23:59'), 1439);
      expect(minutesOfDay('invalid'), 0);
    });
  });

  group('daysUntil', () {
    test('counts whole days from today', () {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final tomorrow = today.add(const Duration(days: 1));
      final yesterday = today.subtract(const Duration(days: 1));

      String iso(DateTime d) =>
          '${d.year.toString().padLeft(4, '0')}-'
          '${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';

      expect(daysUntil(iso(today)), 0);
      expect(daysUntil(iso(tomorrow)), 1);
      expect(daysUntil(iso(yesterday)), -1);
      expect(daysUntil('not-a-date'), 0);
    });
  });
}
