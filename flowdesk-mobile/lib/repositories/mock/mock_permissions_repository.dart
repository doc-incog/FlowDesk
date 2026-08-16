import 'dart:convert';

import '../../data/mock_data.dart' as mock;
import '../../models/role.dart';
import '../../models/role_definition.dart';
import '../contract/permissions_repository.dart';
import '../persisted_store.dart';

const _rolesKey = 'flowdesk.roles';
const _overridesKey = 'flowdesk.userPermissions';

List<RoleDefinition> _defaultRoles() => Role.values
    .map((r) => RoleDefinition(
          key: r.key,
          label: r.label,
          blurb: r.blurb,
          builtin: true,
          sections: (mock.defaultRolePermissions[r.key] ?? const []).toSet(),
        ))
    .toList();

class MockPermissionsRepository implements PermissionsRepository {
  MockPermissionsRepository(this._store);

  final PersistedStore _store;

  @override
  List<RoleDefinition> getRoles() =>
      _store.load(_rolesKey, _defaultRoles(), (r) => r.toJson(), RoleDefinition.fromJson);

  @override
  RoleDefinition? findRole(String key) {
    for (final r in getRoles()) {
      if (r.key == key) return r;
    }
    return null;
  }

  @override
  void saveRole(RoleDefinition role) {
    final roles = getRoles();
    final next = role.builtin
        ? roles.map((r) => r.key == role.key ? role : r).toList()
        : [role, ...roles.where((r) => r.key != role.key)];
    _store.save(_rolesKey, next, (r) => r.toJson());
  }

  @override
  void deleteRole(String key) {
    final next = getRoles().where((r) => r.key != key).toList();
    _store.save(_rolesKey, next, (r) => r.toJson());
  }

  @override
  Map<String, Set<String>> getOverrides() {
    final raw = _store.getString(_overridesKey);
    if (raw == null) return {};
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return decoded.map(
          (k, v) => MapEntry(k, (v as List<dynamic>).cast<String>().toSet()));
    } catch (_) {
      return {};
    }
  }

  @override
  void setOverride(String userId, Set<String>? sections) {
    final overrides = getOverrides();
    if (sections == null) {
      overrides.remove(userId);
    } else {
      overrides[userId] = sections;
    }
    _store.setString(
        _overridesKey, jsonEncode(overrides.map((k, v) => MapEntry(k, v.toList()))));
  }
}
