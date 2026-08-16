import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user.dart';
import 'repositories.dart';

class DirectoryData {
  const DirectoryData({required this.students, required this.staff});

  final List<UserProfile> students;
  final List<UserProfile> staff;

  List<UserProfile> get allPeople => [...students, ...staff];
}

class DirectoryController extends Notifier<DirectoryData> {
  @override
  DirectoryData build() {
    final repo = ref.watch(directoryRepositoryProvider);
    return DirectoryData(students: repo.getStudents(), staff: repo.getStaff());
  }

  void _refresh() {
    final repo = ref.read(directoryRepositoryProvider);
    state = DirectoryData(students: repo.getStudents(), staff: repo.getStaff());
  }

  void addStudent(UserProfile person) {
    ref.read(directoryRepositoryProvider).addStudent(person);
    _refresh();
  }

  void addStaff(UserProfile person) {
    ref.read(directoryRepositoryProvider).addStaff(person);
    _refresh();
  }

  void updatePerson(UserProfile person) {
    ref.read(directoryRepositoryProvider).updatePerson(person);
    _refresh();
  }
}

final directoryProvider =
    NotifierProvider<DirectoryController, DirectoryData>(DirectoryController.new);
