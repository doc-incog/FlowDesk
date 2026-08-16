import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/core/utils/logic.dart';
import 'package:flowdesk_mobile/models/admission.dart';
import 'package:flowdesk_mobile/models/feedback.dart';
import 'package:flowdesk_mobile/models/schedule_slot.dart';

ScheduleSlot slot(String id, String day, String start, String end,
        {String room = 'R1', String staff = 'P1'}) =>
    ScheduleSlot(
      id: id,
      day: day,
      start: start,
      end: end,
      module: 'Module $id',
      code: 'CODE-$id',
      room: room,
      staff: staff,
    );

void main() {
  group('nextAdmissionStatus', () {
    test('advances linearly through the queue', () {
      expect(nextAdmissionStatus(AdmissionStatus.submitted),
          AdmissionStatus.reviewing);
      expect(nextAdmissionStatus(AdmissionStatus.reviewing),
          AdmissionStatus.accepted);
    });

    test('terminal states return null', () {
      expect(nextAdmissionStatus(AdmissionStatus.accepted), isNull);
      expect(nextAdmissionStatus(AdmissionStatus.rejected), isNull);
    });
  });

  group('seatFor', () {
    test('allocates seats in enrolment order', () {
      expect(seatFor('STU-2043'), 1);
      expect(seatFor('STU-2044'), 2);
      expect(seatFor('STU-2045'), 3);
    });

    test('unknown student gets seat 0', () {
      expect(seatFor('STU-0000'), 0);
    });
  });

  group('averageRating', () {
    final entries = [
      FeedbackEntry(
          id: '1',
          targetId: 'T1',
          rating: 4,
          comment: '',
          byName: 'A',
          createdAt: ''),
      FeedbackEntry(
          id: '2',
          targetId: 'T1',
          rating: 5,
          comment: '',
          byName: 'B',
          createdAt: ''),
      FeedbackEntry(
          id: '3',
          targetId: 'T2',
          rating: 1,
          comment: '',
          byName: 'C',
          createdAt: ''),
    ];

    test('averages entries for a target', () {
      expect(averageRating(entries, 'T1'), 4.5);
    });

    test('returns 0 when target has no entries', () {
      expect(averageRating(entries, 'T3'), 0);
    });
  });

  group('detectConflicts', () {
    final base = [
      slot('1', 'Mon', '09:00', '10:00'),
    ];

    test('flags same-day overlapping slot in the same room', () {
      final conflicts =
          detectConflicts(base, slot('2', 'Mon', '09:30', '10:30', room: 'R1'));
      expect(conflicts, hasLength(1));
      expect(conflicts.first.id, '1');
    });

    test('flags overlapping slot with same faculty in a different room', () {
      final conflicts =
          detectConflicts(base, slot('2', 'Mon', '09:30', '10:30',
              room: 'R2', staff: 'P1'));
      expect(conflicts, hasLength(1));
    });

    test('ignores non-overlapping slots on the same day', () {
      final conflicts =
          detectConflicts(base, slot('2', 'Mon', '10:30', '11:30', room: 'R1'));
      expect(conflicts, isEmpty);
    });

    test('ignores overlapping slots on a different day', () {
      final conflicts =
          detectConflicts(base, slot('2', 'Tue', '09:30', '10:30', room: 'R1'));
      expect(conflicts, isEmpty);
    });

    test('ignores overlap with no shared room or faculty', () {
      final conflicts = detectConflicts(
          base, slot('2', 'Mon', '09:30', '10:30', room: 'R2', staff: 'P2'));
      expect(conflicts, isEmpty);
    });

    test('flags a Sunday slot against another Sunday slot in the same room', () {
      final sundayBase = [slot('7', 'Sun', '10:00', '12:00', room: 'C-101')];
      final conflicts = detectConflicts(
          sundayBase, slot('8', 'Sun', '11:00', '13:00', room: 'C-101'));
      expect(conflicts, hasLength(1));
    });

    test('ignores a Monday slot colliding with a Sunday slot', () {
      final sundayBase = [slot('7', 'Sun', '10:00', '12:00', room: 'C-101')];
      final conflicts = detectConflicts(
          sundayBase, slot('8', 'Mon', '10:30', '11:30', room: 'C-101'));
      expect(conflicts, isEmpty);
    });
  });
}
