import '../../data/mock_data.dart' as mock;
import '../../models/user.dart';
import '../contract/directory_repository.dart';
import '../persisted_store.dart';

const _studentsKey = 'flowdesk.directory.students';
const _staffKey = 'flowdesk.directory.staff';

class MockDirectoryRepository implements DirectoryRepository {
  MockDirectoryRepository(this._store);

  final PersistedStore _store;

  @override
  List<UserProfile> getStudents() =>
      _store.load(_studentsKey, mock.students, (p) => p.toJson(), UserProfile.fromJson);

  @override
  List<UserProfile> getStaff() =>
      _store.load(_staffKey, mock.staff, (p) => p.toJson(), UserProfile.fromJson);

  @override
  List<UserProfile> allPeople() => [...getStudents(), ...getStaff()];

  @override
  UserProfile? findById(String id) {
    for (final p in allPeople()) {
      if (p.id == id) return p;
    }
    return null;
  }

  @override
  UserProfile? findByEmail(String email) {
    final normalized = email.trim().toLowerCase();
    for (final p in allPeople()) {
      if (p.email.toLowerCase() == normalized) return p;
    }
    return null;
  }

  @override
  List<UserProfile> addStudent(UserProfile person) {
    final next = [person, ...getStudents()];
    _store.save(_studentsKey, next, (p) => p.toJson());
    return next;
  }

  @override
  List<UserProfile> addStaff(UserProfile person) {
    final next = [person, ...getStaff()];
    _store.save(_staffKey, next, (p) => p.toJson());
    return next;
  }

  @override
  void updatePerson(UserProfile person) {
    final students = getStudents();
    if (students.any((p) => p.id == person.id)) {
      _store.save(
        _studentsKey,
        students.map((p) => p.id == person.id ? person : p).toList(),
        (p) => p.toJson(),
      );
      return;
    }
    final staff = getStaff();
    if (staff.any((p) => p.id == person.id)) {
      _store.save(
        _staffKey,
        staff.map((p) => p.id == person.id ? person : p).toList(),
        (p) => p.toJson(),
      );
    }
  }
}
