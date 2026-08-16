import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user.dart';
import 'auth_controller.dart';
import 'repositories.dart';

class ProfileController extends Notifier<UserProfile?> {
  @override
  UserProfile? build() => ref.watch(authProvider);

  /// Persists self-profile edits into the directory (so they survive a
  /// session restore) and refreshes the signed-in user.
  void save(UserProfile updated) {
    ref.read(directoryRepositoryProvider).updatePerson(updated);
    ref.read(authProvider.notifier).updateUser(updated);
  }
}

final profileProvider =
    NotifierProvider<ProfileController, UserProfile?>(ProfileController.new);
