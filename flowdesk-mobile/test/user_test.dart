import 'package:flutter_test/flutter_test.dart';
import 'package:flowdesk_mobile/models/role.dart';
import 'package:flowdesk_mobile/models/user.dart';

void main() {
  group('UserProfile json round-trip', () {
    test('preserves built-in role and student fields', () {
      const original = UserProfile(
        id: 'STU-2043',
        name: 'Aisha Karim',
        role: Role.student,
        email: 'aisha.karim@campus.edu',
        avatarInitials: 'AK',
        department: 'Computer Science',
        semester: 'Semester 5',
        rollNo: 'CS23-2043',
        phone: '+91 98765 12345',
        address: '204, Lakeview Residency, Pune',
        dob: '2005-04-12',
      );

      final restored = UserProfile.fromJson(original.toJson());

      expect(restored.id, original.id);
      expect(restored.name, original.name);
      expect(restored.role, Role.student);
      expect(restored.roleKeyValue, 'student');
      expect(restored.phone, original.phone);
      expect(restored.address, original.address);
      expect(restored.dob, original.dob);
      expect(restored.subjects, isNull);
    });

    test('preserves custom role key and subjects', () {
      final original = UserProfile(
        id: 'STF-118',
        name: 'Dr. Rahul Menon',
        role: Role.staff,
        roleKey: 'hod',
        email: 'rahul.menon@campus.edu',
        avatarInitials: 'RM',
        department: 'Computer Science',
        designation: 'Associate Professor',
        subjects: ['Data Structures', 'Operating Systems'],
      );

      final restored = UserProfile.fromJson(original.toJson());

      expect(restored.roleKeyValue, 'hod');
      expect(restored.role, Role.staff);
      expect(restored.subjects, ['Data Structures', 'Operating Systems']);
    });

    test('roleKey falls back to the built-in role when absent', () {
      final json = {
        'id': 'STU-1',
        'name': 'Test User',
        'role': 'staff',
        'email': 'test@campus.edu',
        'avatarInitials': 'TU',
        'department': 'CS',
      };

      final restored = UserProfile.fromJson(json);

      expect(restored.roleKeyValue, 'staff');
      expect(restored.role, Role.staff);
    });
  });

  group('UserProfile copyWith', () {
    test('updates contact fields without disturbing role', () {
      const base = UserProfile(
        id: 'STU-1',
        name: 'Aisha',
        role: Role.student,
        email: 'a@campus.edu',
        avatarInitials: 'A',
        department: 'CS',
      );

      final updated = base.copyWith(
        phone: '+91 12345',
        roleKey: 'researcher',
        subjects: ['AI'],
      );

      expect(updated.phone, '+91 12345');
      expect(updated.roleKeyValue, 'researcher');
      expect(updated.role, Role.student);
      expect(updated.id, 'STU-1');
    });
  });
}
