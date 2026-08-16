import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../repositories/contract/admissions_repository.dart';
import '../repositories/contract/assignments_repository.dart';
import '../repositories/contract/auth_repository.dart';
import '../repositories/contract/complaints_repository.dart';
import '../repositories/contract/directory_repository.dart';
import '../repositories/contract/exams_repository.dart';
import '../repositories/contract/feedback_repository.dart';
import '../repositories/contract/fees_repository.dart';
import '../repositories/contract/permissions_repository.dart';
import '../repositories/contract/schedule_repository.dart';
import '../repositories/contract/scholarships_repository.dart';
import '../repositories/mock/mock_admissions_repository.dart';
import '../repositories/mock/mock_assignments_repository.dart';
import '../repositories/mock/mock_auth_repository.dart';
import '../repositories/mock/mock_complaints_repository.dart';
import '../repositories/mock/mock_directory_repository.dart';
import '../repositories/mock/mock_exams_repository.dart';
import '../repositories/mock/mock_feedback_repository.dart';
import '../repositories/mock/mock_fees_repository.dart';
import '../repositories/mock/mock_permissions_repository.dart';
import '../repositories/mock/mock_schedule_repository.dart';
import '../repositories/mock/mock_scholarships_repository.dart';
import '../repositories/persisted_store.dart';

/// Overridden in main.dart with the real SharedPreferences instance.
final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPrefsProvider must be overridden in main'),
);

final persistedStoreProvider = Provider<PersistedStore>(
  (ref) => PersistedStore(ref.watch(sharedPrefsProvider)),
);

/// Composition root: swap mock implementations for remote/API ones here.
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => MockAuthRepository(
    ref.watch(persistedStoreProvider),
    ref.watch(directoryRepositoryProvider),
  ),
);

final directoryRepositoryProvider = Provider<DirectoryRepository>(
  (ref) => MockDirectoryRepository(ref.watch(persistedStoreProvider)),
);

final permissionsRepositoryProvider = Provider<PermissionsRepository>(
  (ref) => MockPermissionsRepository(ref.watch(persistedStoreProvider)),
);

final scheduleRepositoryProvider = Provider<ScheduleRepository>(
  (ref) => MockScheduleRepository(ref.watch(persistedStoreProvider)),
);

final examsRepositoryProvider = Provider<ExamsRepository>(
  (ref) => MockExamsRepository(ref.watch(persistedStoreProvider)),
);

final assignmentsRepositoryProvider = Provider<AssignmentsRepository>(
  (ref) => MockAssignmentsRepository(ref.watch(persistedStoreProvider)),
);

final feesRepositoryProvider = Provider<FeesRepository>(
  (ref) => MockFeesRepository(ref.watch(persistedStoreProvider)),
);

final scholarshipsRepositoryProvider = Provider<ScholarshipsRepository>(
  (ref) => MockScholarshipsRepository(ref.watch(persistedStoreProvider)),
);

final admissionsRepositoryProvider = Provider<AdmissionsRepository>(
  (ref) => MockAdmissionsRepository(ref.watch(persistedStoreProvider)),
);

final complaintsRepositoryProvider = Provider<ComplaintsRepository>(
  (ref) => MockComplaintsRepository(ref.watch(persistedStoreProvider)),
);

final feedbackRepositoryProvider = Provider<FeedbackRepository>(
  (ref) => MockFeedbackRepository(ref.watch(persistedStoreProvider)),
);
