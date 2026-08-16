class Mentor {
  const Mentor({
    required this.id,
    required this.name,
    required this.designation,
    required this.department,
    required this.email,
    required this.phone,
    required this.office,
    required this.officeHours,
    required this.avatarInitials,
    required this.mentees,
  });

  final String id;
  final String name;
  final String designation;
  final String department;
  final String email;
  final String phone;
  final String office;
  final String officeHours;
  final String avatarInitials;
  final int mentees;
}
