import '../../models/exam.dart';

abstract class ExamsRepository {
  List<Exam> getExams();
  List<ResultRow> getResults();

  /// Adds an exam and returns the updated list.
  List<Exam> addExam(Exam exam);

  /// Deletes an exam and returns the updated list.
  List<Exam> deleteExam(String examId);

  /// Persists marks for every student of the given exam and returns the
  /// updated results list. Marks are keyed by student id.
  List<ResultRow> saveResults(String examId, Map<String, int> marksByStudent);
}
