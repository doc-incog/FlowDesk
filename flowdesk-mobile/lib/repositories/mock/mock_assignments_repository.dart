import '../../data/assignments_data.dart' as data;
import '../../models/assignment.dart';
import '../contract/assignments_repository.dart';
import '../persisted_store.dart';

const _assignmentsKey = 'flowdesk.assignments';
const _submissionsKey = 'flowdesk.submissions';

class MockAssignmentsRepository implements AssignmentsRepository {
  MockAssignmentsRepository(this._store);

  final PersistedStore _store;

  @override
  List<Assignment> getAssignments() => _store.load(
      _assignmentsKey, data.assignments, (a) => a.toJson(), Assignment.fromJson);

  @override
  List<Submission> getSubmissions() => _store.load(
      _submissionsKey, data.seedSubmissions, (s) => s.toJson(), Submission.fromJson);

  @override
  List<Assignment> addAssignment(Assignment assignment) {
    final next = [assignment, ...getAssignments()];
    _store.save(_assignmentsKey, next, (a) => a.toJson());
    return next;
  }

  @override
  List<Assignment> deleteAssignment(String id) {
    final next = getAssignments().where((a) => a.id != id).toList();
    _store.save(_assignmentsKey, next, (a) => a.toJson());
    return next;
  }

  @override
  List<Submission> submit(Submission submission) {
    final next = [submission, ...getSubmissions()];
    _store.save(_submissionsKey, next, (s) => s.toJson());
    return next;
  }

  @override
  List<Submission> grade(String submissionId, int marks, String feedback) {
    final next = getSubmissions()
        .map((s) => s.id == submissionId ? s.copyWith(marks: marks, feedback: feedback) : s)
        .toList();
    _store.save(_submissionsKey, next, (s) => s.toJson());
    return next;
  }
}
