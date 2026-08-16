enum Role {
  student('student', 'Student'),
  staff('staff', 'Staff'),
  admin('admin', 'Administrator');

  const Role(this.key, this.label);

  final String key;
  final String label;

  static Role fromKey(String key) =>
      Role.values.firstWhere((r) => r.key == key, orElse: () => Role.student);

  String get blurb => switch (this) {
        Role.student => 'Check in, track modules, and stay connected with your mentor.',
        Role.staff => 'Manage attendance, classes and mentee guidance.',
        Role.admin => 'Oversee the whole campus, people and biometric access.',
      };
}
