import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/core/utils/grades.dart';

void main() {
  group('percentage', () {
    test('computes rounded percentage', () {
      expect(percentage(50, 100), 50);
      expect(percentage(33, 100), 33);
      expect(percentage(1, 3), 33);
      expect(percentage(10, 0), 0);
    });
  });

  group('gradeFor', () {
    test('returns grade for percentage bands', () {
      expect(gradeFor(95), 'A+');
      expect(gradeFor(90), 'A+');
      expect(gradeFor(89), 'A');
      expect(gradeFor(80), 'A');
      expect(gradeFor(79), 'B+');
      expect(gradeFor(70), 'B+');
      expect(gradeFor(69), 'B');
      expect(gradeFor(60), 'B');
      expect(gradeFor(59), 'C+');
      expect(gradeFor(50), 'C+');
      expect(gradeFor(49), 'C');
      expect(gradeFor(40), 'C');
      expect(gradeFor(39), 'D');
      expect(gradeFor(0), 'D');
    });
  });
}
