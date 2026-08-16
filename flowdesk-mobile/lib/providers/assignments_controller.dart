import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/assignment.dart';
import 'repositories.dart';

class AssignmentsController extends Notifier<List<Assignment>> {
  @override
  List<Assignment> build() {
    return ref.watch(assignmentsRepositoryProvider).getAssignments();
  }

  void add(Assignment assignment) {
    state = ref.read(assignmentsRepositoryProvider).addAssignment(assignment);
  }

  void delete(String id) {
    state = ref.read(assignmentsRepositoryProvider).deleteAssignment(id);
  }
}

class SubmissionsController extends Notifier<List<Submission>> {
  @override
  List<Submission> build() {
    return ref.watch(assignmentsRepositoryProvider).getSubmissions();
  }

  void submit(Submission submission) {
    state = ref.read(assignmentsRepositoryProvider).submit(submission);
  }

  void grade(String id, int marks, String feedback) {
    state = ref.read(assignmentsRepositoryProvider).grade(id, marks, feedback);
  }
}

final assignmentsProvider =
    NotifierProvider<AssignmentsController, List<Assignment>>(AssignmentsController.new);
final submissionsProvider =
    NotifierProvider<SubmissionsController, List<Submission>>(SubmissionsController.new);
