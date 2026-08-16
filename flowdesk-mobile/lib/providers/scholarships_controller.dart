import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/scholarship.dart';
import 'repositories.dart';

final scholarshipsProvider = Provider<List<Scholarship>>(
  (ref) => ref.watch(scholarshipsRepositoryProvider).getScholarships(),
);

class ScholarshipApplicationsController extends Notifier<List<ScholarshipApplication>> {
  @override
  List<ScholarshipApplication> build() {
    return ref.watch(scholarshipsRepositoryProvider).getApplications();
  }

  void apply(ScholarshipApplication application) {
    state = ref.read(scholarshipsRepositoryProvider).apply(application);
  }

  void setStatus(String id, ScholarshipStatus status) {
    state = ref.read(scholarshipsRepositoryProvider).setStatus(id, status);
  }
}

final scholarshipApplicationsProvider = NotifierProvider<ScholarshipApplicationsController,
    List<ScholarshipApplication>>(ScholarshipApplicationsController.new);
