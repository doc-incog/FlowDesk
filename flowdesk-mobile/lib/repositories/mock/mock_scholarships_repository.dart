import '../../data/scholarships_data.dart' as data;
import '../../models/scholarship.dart';
import '../contract/scholarships_repository.dart';
import '../persisted_store.dart';

const _scholarshipsKey = 'flowdesk.scholarships';

class MockScholarshipsRepository implements ScholarshipsRepository {
  MockScholarshipsRepository(this._store);

  final PersistedStore _store;

  @override
  List<Scholarship> getScholarships() => data.scholarships;

  @override
  List<ScholarshipApplication> getApplications() => _store.load(
      _scholarshipsKey,
      data.seedScholarshipApplications,
      (a) => a.toJson(),
      ScholarshipApplication.fromJson);

  @override
  List<ScholarshipApplication> apply(ScholarshipApplication application) {
    final next = [application, ...getApplications()];
    _store.save(_scholarshipsKey, next, (a) => a.toJson());
    return next;
  }

  @override
  List<ScholarshipApplication> setStatus(String applicationId, ScholarshipStatus status) {
    final next = getApplications()
        .map((a) => a.id == applicationId ? a.copyWith(status: status) : a)
        .toList();
    _store.save(_scholarshipsKey, next, (a) => a.toJson());
    return next;
  }
}
