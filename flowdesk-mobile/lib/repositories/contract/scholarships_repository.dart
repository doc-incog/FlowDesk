import '../../models/scholarship.dart';

abstract class ScholarshipsRepository {
  List<Scholarship> getScholarships();
  List<ScholarshipApplication> getApplications();

  List<ScholarshipApplication> apply(ScholarshipApplication application);
  List<ScholarshipApplication> setStatus(String applicationId, ScholarshipStatus status);
}
