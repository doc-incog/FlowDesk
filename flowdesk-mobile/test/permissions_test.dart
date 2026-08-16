import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/core/utils/logic.dart';
import 'package:flowdesk_mobile/models/role_definition.dart';
import 'package:flowdesk_mobile/repositories/mock/mock_permissions_repository.dart';
import 'package:flowdesk_mobile/repositories/persisted_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

RoleDefinition role(String key,
        {List<String> sections = const [], bool builtin = false}) =>
    RoleDefinition(
      key: key,
      label: key,
      blurb: '',
      builtin: builtin,
      sections: sections.toSet(),
    );

void main() {
  group('effectiveSectionsFor', () {
    final roles = [
      role('student', sections: ['overview', 'fees']),
      role('staff', sections: ['overview', 'students']),
      role('custom', sections: ['schedule']),
    ];

    test('uses role defaults when no per-user override exists', () {
      final result = effectiveSectionsFor(roles, {}, 'staff', 'U-1');
      expect(result, containsAll(['overview', 'students']));
      expect(result, isNot(contains('fees')));
    });

    test('per-user override wins over the role default', () {
      const overrides = {'U-1': {'schedule'}};
      final result = effectiveSectionsFor(roles, overrides, 'staff', 'U-1');
      expect(result, {'schedule'});
    });

    test('other users are not affected by an override', () {
      const overrides = {'U-1': {'schedule'}};
      final result = effectiveSectionsFor(roles, overrides, 'staff', 'U-2');
      expect(result, contains('students'));
    });

    test('unknown role falls back to student visibility', () {
      final result = effectiveSectionsFor(roles, {}, 'nobody', 'U-1');
      expect(result, isNotEmpty);
      expect(result, contains('overview'));
    });
  });

  group('MockPermissionsRepository', () {
    late PersistedStore store;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      store = PersistedStore(prefs);
    });

    test('seeds the three built-in roles', () {
      final repo = MockPermissionsRepository(store);
      final roles = repo.getRoles();
      expect(roles, hasLength(3));
      for (final r in roles) {
        expect(r.builtin, isTrue);
      }
      expect(roles.map((r) => r.key), containsAll(['student', 'staff', 'admin']));
    });

    test('adds and persists a custom role across instances', () {
      MockPermissionsRepository(store).saveRole(role('library', sections: ['schedule', 'helpdesk']));

      final reloaded = MockPermissionsRepository(store);
      expect(reloaded.findRole('library')?.sections, containsAll(['schedule', 'helpdesk']));
      expect(reloaded.getRoles(), hasLength(4));
    });

    test('deletes a custom role', () {
      final repo = MockPermissionsRepository(store);
      repo.saveRole(role('temp'));
      repo.deleteRole('temp');
      expect(repo.findRole('temp'), isNull);
    });

    test('setOverride persists and null clears', () {
      final repo = MockPermissionsRepository(store);
      repo.setOverride('U-1', {'schedule'});

      final reloaded = MockPermissionsRepository(store);
      expect(reloaded.getOverrides()['U-1'], {'schedule'});

      reloaded.setOverride('U-1', null);
      expect(MockPermissionsRepository(store).getOverrides(), isEmpty);
    });
  });

  group('RoleDefinition json', () {
    test('round-trips sections and builtin flag', () {
      const original = RoleDefinition(
          key: 'hod',
          label: 'Head of Department',
          blurb: 'Oversees a department.',
          builtin: false,
          sections: {'overview', 'students', 'schedule'});

      final restored = RoleDefinition.fromJson(original.toJson());

      expect(restored.key, 'hod');
      expect(restored.label, 'Head of Department');
      expect(restored.builtin, isFalse);
      expect(restored.sections, {'overview', 'students', 'schedule'});
    });
  });
}
