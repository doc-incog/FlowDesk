import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user.dart';
import 'repositories.dart';

class AuthController extends Notifier<UserProfile?> {
  @override
  UserProfile? build() {
    return ref.watch(authRepositoryProvider).restoreSession();
  }

  bool login(String email, String password) {
    final profile = ref.read(authRepositoryProvider).login(email, password);
    if (profile != null) state = profile;
    return profile != null;
  }

  void logout() {
    ref.read(authRepositoryProvider).logout();
    state = null;
  }
}

final authProvider = NotifierProvider<AuthController, UserProfile?>(AuthController.new);
