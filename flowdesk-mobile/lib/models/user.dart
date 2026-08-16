import 'role.dart';

class UserProfile {
  const UserProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.email,
    required this.avatarInitials,
    required this.department,
    this.batch,
    this.semester,
    this.rollNo,
    this.mentorId,
    this.designation,
    this.subjects,
  });

  final String id;
  final String name;
  final Role role;
  final String email;
  final String avatarInitials;
  final String department;

  // student-specific
  final String? batch;
  final String? semester;
  final String? rollNo;
  final String? mentorId;

  // staff-specific
  final String? designation;
  final List<String>? subjects;

  UserProfile copyWith({
    String? id,
    String? name,
    Role? role,
    String? email,
    String? avatarInitials,
    String? department,
    String? batch,
    String? semester,
    String? rollNo,
    String? mentorId,
    String? designation,
    List<String>? subjects,
  }) {
    return UserProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
      email: email ?? this.email,
      avatarInitials: avatarInitials ?? this.avatarInitials,
      department: department ?? this.department,
      batch: batch ?? this.batch,
      semester: semester ?? this.semester,
      rollNo: rollNo ?? this.rollNo,
      mentorId: mentorId ?? this.mentorId,
      designation: designation ?? this.designation,
      subjects: subjects ?? this.subjects,
    );
  }
}
