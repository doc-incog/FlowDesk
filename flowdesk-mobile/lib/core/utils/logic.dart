import '../../models/admission.dart';
import '../../models/feedback.dart';
import '../../models/schedule_slot.dart';
import '../../data/mock_data.dart' as mock;

/// Linear admission workflow: submitted -> reviewing -> accepted.
/// Returns null for terminal states.
AdmissionStatus? nextAdmissionStatus(AdmissionStatus status) {
  return switch (status) {
    AdmissionStatus.submitted => AdmissionStatus.reviewing,
    AdmissionStatus.reviewing => AdmissionStatus.accepted,
    AdmissionStatus.accepted => null,
    AdmissionStatus.rejected => null,
  };
}

/// Deterministic seat allocation: students seated in enrolment order.
int seatFor(String studentId) {
  final idx = mock.students.indexWhere((s) => s.id == studentId);
  return idx >= 0 ? idx + 1 : 0;
}

/// Mean rating for a target, rounded to 1 decimal. 0 for empty.
double averageRating(List<FeedbackEntry> entries, String targetId) {
  final filtered = entries.where((e) => e.targetId == targetId).toList();
  if (filtered.isEmpty) return 0;
  final sum = filtered.fold<int>(0, (acc, e) => acc + e.rating);
  return (sum / filtered.length * 10).round() / 10;
}

/// Detects schedule conflicts: same day, overlapping time, and a shared
/// room or shared faculty member.
List<ScheduleSlot> detectConflicts(List<ScheduleSlot> slots, ScheduleSlot draft) {
  return slots.where((s) => _conflictsWith(s, draft)).toList();
}

bool _conflictsWith(ScheduleSlot a, ScheduleSlot b) {
  if (a.day != b.day) return false;
  final overlaps = _toMin(a.start) < _toMin(b.end) && _toMin(b.start) < _toMin(a.end);
  if (!overlaps) return false;
  return a.room == b.room || a.staff == b.staff;
}

int _toMin(String hhmm) {
  final parts = hhmm.split(':');
  if (parts.length != 2) return 0;
  return (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
}
