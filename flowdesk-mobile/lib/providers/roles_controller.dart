import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/utils/logic.dart';
import '../models/role_definition.dart';
import 'repositories.dart';

class RolesData {
  const RolesData({required this.roles, required this.overrides});

  final List<RoleDefinition> roles;
  final Map<String, Set<String>> overrides;

  Set<String> effectiveSections(String roleKey, String userId) =>
      effectiveSectionsFor(roles, overrides, roleKey, userId);

  String? labelFor(String roleKey) {
    for (final r in roles) {
      if (r.key == roleKey) return r.label;
    }
    return null;
  }

  bool isBuiltIn(String roleKey) {
    for (final r in roles) {
      if (r.key == roleKey) return r.builtin;
    }
    return false;
  }
}

class RolesController extends Notifier<RolesData> {
  @override
  RolesData build() {
    final repo = ref.watch(permissionsRepositoryProvider);
    return RolesData(roles: repo.getRoles(), overrides: repo.getOverrides());
  }

  void _refresh() {
    final repo = ref.read(permissionsRepositoryProvider);
    state = RolesData(roles: repo.getRoles(), overrides: repo.getOverrides());
  }

  void saveRole(RoleDefinition role) {
    ref.read(permissionsRepositoryProvider).saveRole(role);
    _refresh();
  }

  void deleteRole(String key) {
    ref.read(permissionsRepositoryProvider).deleteRole(key);
    _refresh();
  }

  void setOverride(String userId, Set<String>? sections) {
    ref.read(permissionsRepositoryProvider).setOverride(userId, sections);
    _refresh();
  }
}

final rolesProvider =
    NotifierProvider<RolesController, RolesData>(RolesController.new);
