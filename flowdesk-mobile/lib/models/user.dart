import 'role.dart';

class UserProfile {
  const UserProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.email,
    required this.avatarInitials,
    required this.department,
    this.roleKey,
    this.batch,
    this.semester,
    this.rollNo,
    this.mentorId,
    this.designation,
    this.subjects,
    this.phone,
    this.address,
    this.guardianName,
    this.guardianPhone,
    this.emergencyContact,
    this.dob,
  });

  final String id;
  final String name;
  final Role role;
  final String email;
  final String avatarInitials;
  final String department;

  /// Custom role key for roles beyond the built-in three. Falls back to the
  /// built-in role key when unset.
  final String? roleKey;
  String get roleKeyValue => roleKey ?? role.key;

  // student-specific
  final String? batch;
  final String? semester;
  final String? rollNo;
  final String? mentorId;

  // staff-specific
  final String? designation;
  final List<String>? subjects;

  // contact details
  final String? phone;
  final String? address;
  final String? guardianName;
  final String? guardianPhone;
  final String? emergencyContact;
  final String? dob;

  UserProfile copyWith({
    String? id,
    String? name,
    Role? role,
    String? email,
    String? avatarInitials,
    String? department,
    String? roleKey,
    String? batch,
    String? semester,
    String? rollNo,
    String? mentorId,
    String? designation,
    List<String>? subjects,
    String? phone,
    String? address,
    String? guardianName,
    String? guardianPhone,
    String? emergencyContact,
    String? dob,
  }) {
    return UserProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
      email: email ?? this.email,
      avatarInitials: avatarInitials ?? this.avatarInitials,
      department: department ?? this.department,
      roleKey: roleKey ?? this.roleKey,
      batch: batch ?? this.batch,
      semester: semester ?? this.semester,
      rollNo: rollNo ?? this.rollNo,
      mentorId: mentorId ?? this.mentorId,
      designation: designation ?? this.designation,
      subjects: subjects ?? this.subjects,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      guardianName: guardianName ?? this.guardianName,
      guardianPhone: guardianPhone ?? this.guardianPhone,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      dob: dob ?? this.dob,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'role': role.key,
        'roleKey': roleKey,
        'email': email,
        'avatarInitials': avatarInitials,
        'department': department,
        'batch': batch,
        'semester': semester,
        'rollNo': rollNo,
        'mentorId': mentorId,
        'designation': designation,
        'subjects': subjects,
        'phone': phone,
        'address': address,
        'guardianName': guardianName,
        'guardianPhone': guardianPhone,
        'emergencyContact': emergencyContact,
        'dob': dob,
      };

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        name: json['name'] as String,
        role: Role.fromKey(json['role'] as String),
        roleKey: json['roleKey'] as String?,
        email: json['email'] as String,
        avatarInitials: json['avatarInitials'] as String,
        department: json['department'] as String,
        batch: json['batch'] as String?,
        semester: json['semester'] as String?,
        rollNo: json['rollNo'] as String?,
        mentorId: json['mentorId'] as String?,
        designation: json['designation'] as String?,
        subjects: (json['subjects'] as List<dynamic>?)?.cast<String>(),
        phone: json['phone'] as String?,
        address: json['address'] as String?,
        guardianName: json['guardianName'] as String?,
        guardianPhone: json['guardianPhone'] as String?,
        emergencyContact: json['emergencyContact'] as String?,
        dob: json['dob'] as String?,
      );
}
