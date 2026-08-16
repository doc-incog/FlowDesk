import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/exam.dart';
import 'repositories.dart';

class ExamsController extends Notifier<List<Exam>> {
  @override
  List<Exam> build() {
    return ref.watch(examsRepositoryProvider).getExams();
  }

  void addExam(Exam exam) {
    state = ref.read(examsRepositoryProvider).addExam(exam);
  }

  void deleteExam(String id) {
    state = ref.read(examsRepositoryProvider).deleteExam(id);
  }
}

class ResultsController extends Notifier<List<ResultRow>> {
  @override
  List<ResultRow> build() {
    return ref.watch(examsRepositoryProvider).getResults();
  }

  void save(String examId, Map<String, int> marksByStudent) {
    state = ref.read(examsRepositoryProvider).saveResults(examId, marksByStudent);
  }
}

final examsProvider = NotifierProvider<ExamsController, List<Exam>>(ExamsController.new);
final resultsProvider =
    NotifierProvider<ResultsController, List<ResultRow>>(ResultsController.new);
