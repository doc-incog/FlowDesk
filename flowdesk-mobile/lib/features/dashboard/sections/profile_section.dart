import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../models/role.dart';
import '../../../models/user.dart';
import '../../../providers/auth_controller.dart';
import '../../../providers/profile_controller.dart';
import '../../../providers/roles_controller.dart';
import 'widgets.dart';

class ProfileSection extends ConsumerStatefulWidget {
  const ProfileSection({super.key});

  @override
  ConsumerState<ProfileSection> createState() => _ProfileSectionState();
}

class _ProfileSectionState extends ConsumerState<ProfileSection> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _initials;
  late final TextEditingController _department;
  late final TextEditingController _phone;
  late final TextEditingController _dob;
  late final TextEditingController _address;
  late final TextEditingController _rollNo;
  late final TextEditingController _semester;
  late final TextEditingController _batch;
  late final TextEditingController _mentorId;
  late final TextEditingController _designation;
  late final TextEditingController _subjects;
  late final TextEditingController _currentPassword;
  late final TextEditingController _newPassword;

  bool _ready = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_ready) return;
    final user = ref.read(authProvider);
    if (user == null) return;
    _name = TextEditingController(text: user.name);
    _email = TextEditingController(text: user.email);
    _initials = TextEditingController(text: user.avatarInitials);
    _department = TextEditingController(text: user.department);
    _phone = TextEditingController(text: user.phone ?? '');
    _dob = TextEditingController(text: user.dob ?? '');
    _address = TextEditingController(text: user.address ?? '');
    _rollNo = TextEditingController(text: user.rollNo ?? '');
    _semester = TextEditingController(text: user.semester ?? '');
    _batch = TextEditingController(text: user.batch ?? '');
    _mentorId = TextEditingController(text: user.mentorId ?? '');
    _designation = TextEditingController(text: user.designation ?? '');
    _subjects = TextEditingController(text: user.subjects?.join(', ') ?? '');
    _currentPassword = TextEditingController();
    _newPassword = TextEditingController();
    _ready = true;
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _initials.dispose();
    _department.dispose();
    _phone.dispose();
    _dob.dispose();
    _address.dispose();
    _rollNo.dispose();
    _semester.dispose();
    _batch.dispose();
    _mentorId.dispose();
    _designation.dispose();
    _subjects.dispose();
    _currentPassword.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  void _save() {
    final user = ref.read(authProvider);
    if (user == null) return;
    final updated = user.copyWith(
      name: _name.text.trim(),
      email: _email.text.trim(),
      avatarInitials: _initials.text.trim(),
      department: _department.text.trim(),
      phone: _phone.text.trim(),
      dob: _dob.text.trim(),
      address: _address.text.trim(),
      rollNo: _rollNo.text.trim(),
      semester: _semester.text.trim(),
      batch: _batch.text.trim(),
      mentorId: _mentorId.text.trim(),
      designation: _designation.text.trim(),
      subjects: _subjects.text
          .split(',')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList(),
    );
    ref.read(profileProvider.notifier).save(updated);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profile saved.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider);
    if (!_ready || user == null) {
      return const SectionScaffold(title: 'Profile', children: []);
    }
    final isStudent = user.roleKeyValue == 'student';
    final roles = ref.watch(rolesProvider);
    final roleLabel = roles.labelFor(user.roleKeyValue) ?? user.role.label;
    final scheme = Theme.of(context).colorScheme;
    final isWide = Breakpoints.isWide(context) || Breakpoints.isTablet(context);

    return SectionScaffold(
      title: 'Profile',
      description: 'Your personal details, contact info and role-specific fields.',
      children: [
        GlassCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Avatar(initials: _initials.text, size: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_name.text.isEmpty ? user.name : _name.text,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 16)),
                        Text('$roleLabel · ${user.id}',
                            style: TextStyle(
                                fontSize: 12,
                                fontFamily: 'monospace',
                                color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _field('Full name', _name),
              const SizedBox(height: 12),
              _field('Email', _email),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _field('Avatar initials', _initials)),
                  const SizedBox(width: 12),
                  Expanded(child: _field('Department', _department)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _field('Phone', _phone)),
                  const SizedBox(width: 12),
                  Expanded(child: _field('Date of birth', _dob)),
                ],
              ),
              const SizedBox(height: 12),
              _field('Address', _address),
              if (isWide) ...[
                const SizedBox(height: 12),
                if (isStudent) ...[
                  Row(
                    children: [
                      Expanded(child: _field('Roll no', _rollNo)),
                      const SizedBox(width: 12),
                      Expanded(child: _field('Semester', _semester)),
                      const SizedBox(width: 12),
                      Expanded(child: _field('Batch', _batch)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _field('Mentor ID', _mentorId),
                ] else ...[
                  Row(
                    children: [
                      Expanded(child: _field('Designation', _designation)),
                      const SizedBox(width: 12),
                      Expanded(child: _field('Subjects (comma separated)', _subjects)),
                    ],
                  ),
                ],
              ] else ...[
                if (isStudent) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _field('Roll no', _rollNo)),
                      const SizedBox(width: 12),
                      Expanded(child: _field('Semester', _semester)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _field('Batch', _batch)),
                      const SizedBox(width: 12),
                      Expanded(child: _field('Mentor ID', _mentorId)),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 12),
                  _field('Designation', _designation),
                  const SizedBox(height: 12),
                  _field('Subjects (comma separated)', _subjects),
                ],
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.save_outlined, size: 18),
                label: const Text('Save changes'),
              ),
            ],
          ),
        ),
        _ProfileCompleteness(user: user),
        GlassCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Change password',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 14),
              _field('Current password', _currentPassword),
              const SizedBox(height: 12),
              _field('New password', _newPassword),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: _changePassword,
                icon: const Icon(Icons.lock_outline_rounded, size: 18),
                label: const Text('Update password'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _field(String label, TextEditingController controller) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
    );
  }

  void _changePassword() {
    if (_currentPassword.text.isEmpty || _newPassword.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in both password fields.')),
      );
      return;
    }
    _currentPassword.clear();
    _newPassword.clear();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Password updated successfully.')),
    );
  }
}

class _ProfileCompleteness extends StatelessWidget {
  const _ProfileCompleteness({required this.user});

  final UserProfile user;

  @override
  Widget build(BuildContext context) {
    final fields = <String, bool>{
      'Name': user.name.isNotEmpty,
      'Email': user.email.isNotEmpty,
      'Department': user.department.isNotEmpty,
      'Phone': (user.phone ?? '').isNotEmpty,
      'DOB': (user.dob ?? '').isNotEmpty,
      'Address': (user.address ?? '').isNotEmpty,
      'Avatar initials': user.avatarInitials.isNotEmpty,
    };
    if (user.role == Role.student) {
      fields['Roll No'] = (user.rollNo ?? '').isNotEmpty;
      fields['Semester'] = (user.semester ?? '').isNotEmpty;
      fields['Batch'] = (user.batch ?? '').isNotEmpty;
    }
    if (user.role == Role.staff) {
      fields['Designation'] = (user.designation ?? '').isNotEmpty;
      fields['Subjects'] = (user.subjects ?? []).isNotEmpty;
    }

    final filled = fields.values.where((v) => v).length;
    final total = fields.length;
    final pct = total > 0 ? (filled / total * 100).round() : 0;
    final missing = fields.entries.where((e) => !e.value).map((e) => e.key).toList();

    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Profile completeness',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              Text('$pct%',
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: pct >= 80 ? colors.success : colors.warning)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 6,
              backgroundColor: scheme.surfaceContainerHighest,
              valueColor: AlwaysStoppedAnimation(pct >= 80 ? colors.success : colors.warning),
            ),
          ),
          if (missing.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Missing: ${missing.join(', ')}',
              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}
