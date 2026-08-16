import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/models/role.dart';
import 'package:flowdesk_mobile/models/user.dart';
import 'package:flowdesk_mobile/repositories/mock/mock_directory_repository.dart';
import 'package:flowdesk_mobile/repositories/persisted_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

UserProfile person(String id, {String? email, String? roleKey, String? phone}) =>
    UserProfile(
      id: id,
      name: 'Test $id',
      role: Role.student,
      roleKey: roleKey,
      email: email ?? '$id@campus.edu',
      avatarInitials: 'T',
      department: 'CS',
      phone: phone,
    );

void main() {
  late PersistedStore store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    store = PersistedStore(prefs);
  });

  group('MockDirectoryRepository', () {
    test('seeds students and staff lists', () {
      final repo = MockDirectoryRepository(store);
      expect(repo.getStudents(), isNotEmpty);
      expect(repo.getStaff(), isNotEmpty);
    });

    test('addStudent prepends and persists across instances', () {
      MockDirectoryRepository(store).addStudent(person('STU-9999', phone: '+91 11111'));
      final reloaded = MockDirectoryRepository(store);
      expect(reloaded.getStudents().first.id, 'STU-9999');
      expect(reloaded.getStudents().first.phone, '+91 11111');
      expect(reloaded.allPeople().any((p) => p.id == 'STU-9999'), isTrue);
    });

    test('addStaff adds to the staff list', () {
      final repo = MockDirectoryRepository(store);
      repo.addStaff(person('STF-9999', roleKey: 'staff'));
      expect(repo.getStaff().any((p) => p.id == 'STF-9999'), isTrue);
    });

    test('updatePerson edits a student and keeps other people intact', () {
      final repo = MockDirectoryRepository(store);
      final before = repo.getStudents().length;
      final existing = repo.getStudents().first;
      final updated = existing.copyWith(name: 'Renamed', roleKey: 'hod');
      repo.updatePerson(updated);

      final reloaded = MockDirectoryRepository(store);
      expect(reloaded.getStudents(), hasLength(before));
      expect(reloaded.findById(existing.id)?.name, 'Renamed');
      expect(reloaded.findById(existing.id)?.roleKeyValue, 'hod');
    });

    test('updatePerson no-ops for people outside the directory', () {
      final repo = MockDirectoryRepository(store);
      final count = repo.allPeople().length;
      repo.updatePerson(person('STU-0000'));
      expect(MockDirectoryRepository(store).allPeople(), hasLength(count));
    });

    test('findByEmail matches across both lists, case-insensitive', () {
      final repo = MockDirectoryRepository(store);
      final found = repo.findByEmail('  Aisha.Karim@campus.edu ');
      expect(found?.id, 'STU-2043');
    });
  });
}
