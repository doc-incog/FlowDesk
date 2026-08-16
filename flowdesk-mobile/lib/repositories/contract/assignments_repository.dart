import '../../models/assignment.dart';

abstract class AssignmentsRepository {
  List<Assignment> getAssignments();
  List<Submission> getSubmissions();

  List<Assignment> addAssignment(Assignment assignment);
  List<Assignment> deleteAssignment(String id);
  List<Submission> submit(Submission submission);
  List<Submission> grade(String submissionId, int marks, String feedback);
}
