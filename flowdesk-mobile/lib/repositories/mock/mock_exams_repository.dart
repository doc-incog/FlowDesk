import '../../data/exams_data.dart' as data;
import '../../data/mock_data.dart' as mock;
import '../../models/exam.dart';
import '../contract/exams_repository.dart';
import '../persisted_store.dart';

const _examsKey = 'flowdesk.exams';
const _resultsKey = 'flowdesk.results';

class MockExamsRepository implements ExamsRepository {
  MockExamsRepository(this._store);

  final PersistedStore _store;

  @override
  List<Exam> getExams() =>
      _store.load(_examsKey, data.examinations, (e) => e.toJson(), Exam.fromJson);

  @override
  List<ResultRow> getResults() =>
      _store.load(_resultsKey, data.seedResults, (r) => r.toJson(), ResultRow.fromJson);

  @override
  List<Exam> addExam(Exam exam) {
    final exams = getExams();
    final next = [exam, ...exams];
    _store.save(_examsKey, next, (e) => e.toJson());
    return next;
  }

  @override
  List<Exam> deleteExam(String examId) {
    final next = getExams().where((e) => e.id != examId).toList();
    _store.save(_examsKey, next, (e) => e.toJson());
    return next;
  }

  @override
  List<ResultRow> saveResults(String examId, Map<String, int> marksByStudent) {
    final exam = getExams().firstWhere((e) => e.id == examId);
    final results = getResults().where((r) => r.examId != examId).toList();
    final max = exam.maxMarks;
    final next = <ResultRow>[
      ...results,
      for (final s in mock.students)
        ResultRow(
          id: '$examId-${s.id}',
          examId: examId,
          studentId: s.id,
          marks: marksByStudent[s.id] ?? 0,
          maxMarks: max,
        ),
    ];
    _store.save(_resultsKey, next, (r) => r.toJson());
    return next;
  }
}
