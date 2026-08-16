import '../../models/user.dart';

abstract class DirectoryRepository {
  /// Persisted student / staff lists (seeded from mock data).
  List<UserProfile> getStudents();
  List<UserProfile> getStaff();
  List<UserProfile> allPeople();

  UserProfile? findById(String id);
  UserProfile? findByEmail(String email);

  List<UserProfile> addStudent(UserProfile person);
  List<UserProfile> addStaff(UserProfile person);

  /// Updates an existing person in whichever list holds them. No-op when the
  /// person is not in the directory (e.g. the seeded admin).
  void updatePerson(UserProfile person);
}
