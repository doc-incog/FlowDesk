import '../../data/mock_data.dart' as mock;
import '../../models/role.dart';
import '../../models/user.dart';
import '../contract/auth_repository.dart';
import '../contract/directory_repository.dart';
import '../persisted_store.dart';

const _sessionKey = 'flowdesk.session';

/// Default password for every directory account in the demo.
const defaultPassword = 'campus123';

class MockAuthRepository implements AuthRepository {
  MockAuthRepository(this._store, this._directory);

  final PersistedStore _store;
  final DirectoryRepository _directory;

  @override
  UserProfile? restoreSession() {
    final raw = _store.getString(_sessionKey);
    if (raw == null) return null;
    final byId = _directory.findById(raw);
    if (byId != null) return byId;
    // legacy sessions stored a role key instead of a user id
    try {
      return mock.demoUsers.entries
          .firstWhere((e) => e.key.key == raw)
          .value;
    } catch (_) {
      return null;
    }
  }

  @override
  UserProfile? login(String email, String password) {
    final normalized = email.trim().toLowerCase();

    if (normalized == mock.adminCreds.email && password == mock.adminCreds.password) {
      final profile = mock.demoUsers[Role.admin]!;
      _store.setString(_sessionKey, profile.id);
      return profile;
    }

    if (password != defaultPassword) return null;

    final known = _directory.findByEmail(normalized);
    if (known == null) return null;

    _store.setString(_sessionKey, known.id);
    return known;
  }

  @override
  void logout() => _store.remove(_sessionKey);
}
