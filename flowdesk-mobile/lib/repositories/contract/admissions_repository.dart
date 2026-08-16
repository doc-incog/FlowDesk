import '../../models/admission.dart';

abstract class AdmissionsRepository {
  List<Program> getPrograms();
  List<AdmissionApplication> getApplications();

  List<AdmissionApplication> submit(AdmissionApplication application);

  /// Persists status/notes changes and returns the updated list.
  List<AdmissionApplication> update(AdmissionApplication application);
}
