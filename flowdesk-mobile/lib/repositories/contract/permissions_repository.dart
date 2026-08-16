import '../../models/role_definition.dart';

abstract class PermissionsRepository {
  List<RoleDefinition> getRoles();
  RoleDefinition? findRole(String key);

  /// Adds a new role or updates an existing one by key.
  void saveRole(RoleDefinition role);

  void deleteRole(String key);

  /// Per-user section overrides, keyed by user id. Overrides win over role
  /// defaults.
  Map<String, Set<String>> getOverrides();

  /// null clears the override so the role default applies again.
  void setOverride(String userId, Set<String>? sections);
}
