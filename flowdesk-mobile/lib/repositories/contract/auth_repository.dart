import '../../models/user.dart';

abstract class AuthRepository {
  /// Restores the persisted session (if any) as a full profile.
  UserProfile? restoreSession();

  /// Returns a profile on success or null on invalid credentials.
  UserProfile? login(String email, String password);

  void logout();
}
