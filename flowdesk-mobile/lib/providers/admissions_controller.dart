import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/admission.dart';
import 'repositories.dart';

final programsProvider = Provider<List<Program>>(
  (ref) => ref.watch(admissionsRepositoryProvider).getPrograms(),
);

class AdmissionsController extends Notifier<List<AdmissionApplication>> {
  @override
  List<AdmissionApplication> build() {
    return ref.watch(admissionsRepositoryProvider).getApplications();
  }

  void submit(AdmissionApplication application) {
    state = ref.read(admissionsRepositoryProvider).submit(application);
  }

  void update(AdmissionApplication application) {
    state = ref.read(admissionsRepositoryProvider).update(application);
  }
}

final admissionsProvider =
    NotifierProvider<AdmissionsController, List<AdmissionApplication>>(AdmissionsController.new);
