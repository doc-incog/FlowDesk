import '../../data/mock_data.dart' as mock;
import '../../models/role.dart';
import '../../models/user.dart';
import '../contract/auth_repository.dart';
import '../persisted_store.dart';

const _sessionKey = 'flowdesk.session';

class MockAuthRepository implements AuthRepository {
  MockAuthRepository(this._store);

  final PersistedStore _store;

  @override
  UserProfile? restoreSession() {
    final raw = _store.getString(_sessionKey);
    if (raw == null) return null;
    try {
      return mock.demoUsers[Role.fromKey(raw)];
    } catch (_) {
      return null;
    }
  }

  @override
  UserProfile? login(String email, String password) {
    final normalized = email.trim().toLowerCase();

    if (normalized == mock.adminCreds.email && password == mock.adminCreds.password) {
      final profile = mock.demoUsers[Role.admin]!;
      _store.setString(_sessionKey, profile.role.key);
      return profile;
    }

    final known = [...mock.students, ...mock.staff]
        .where((u) => u.email.toLowerCase() == normalized)
        .toList();
    if (known.isEmpty) return null;

    final profile = known.first.role == Role.staff
        ? mock.demoUsers[Role.staff]!
        : mock.demoUsers[Role.student]!;
    _store.setString(_sessionKey, profile.role.key);
    return profile;
  }

  @override
  void logout() => _store.remove(_sessionKey);
}
