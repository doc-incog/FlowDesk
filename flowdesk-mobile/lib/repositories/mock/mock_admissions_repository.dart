import '../../data/admissions_data.dart' as data;
import '../../models/admission.dart';
import '../contract/admissions_repository.dart';
import '../persisted_store.dart';

const _admissionsKey = 'flowdesk.admissions';

class MockAdmissionsRepository implements AdmissionsRepository {
  MockAdmissionsRepository(this._store);

  final PersistedStore _store;

  @override
  List<Program> getPrograms() => data.programs;

  @override
  List<AdmissionApplication> getApplications() => _store.load(
      _admissionsKey,
      data.seedAdmissionApplications,
      (a) => a.toJson(),
      AdmissionApplication.fromJson);

  @override
  List<AdmissionApplication> submit(AdmissionApplication application) {
    final next = [application, ...getApplications()];
    _store.save(_admissionsKey, next, (a) => a.toJson());
    return next;
  }

  @override
  List<AdmissionApplication> update(AdmissionApplication application) {
    final next = getApplications()
        .map((a) => a.id == application.id ? application : a)
        .toList();
    _store.save(_admissionsKey, next, (a) => a.toJson());
    return next;
  }
}
