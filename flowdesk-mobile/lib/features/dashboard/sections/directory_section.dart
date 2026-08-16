import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/role.dart';
import '../../../models/user.dart';
import '../../../providers/auth_controller.dart';
import '../../../providers/directory_controller.dart';
import '../../../providers/roles_controller.dart';
import 'widgets.dart';

enum DirectoryKind { students, staff }

class DirectorySection extends ConsumerStatefulWidget {
  const DirectorySection({super.key, required this.kind, required this.role});

  final DirectoryKind kind;
  final Role role;

  @override
  ConsumerState<DirectorySection> createState() => _DirectorySectionState();
}

class _DirectorySectionState extends ConsumerState<DirectorySection> {
  String _query = '';

  String _mentorName(String? mentorId) {
    if (mentorId == null) return '—';
    final mentor = mock.mentors.where((m) => m.id == mentorId).toList();
    return mentor.isEmpty ? '—' : mentor.first.name;
  }

  bool get _admin => ref.read(authProvider)?.roleKeyValue == 'admin';

  Future<void> _openPersonForm({UserProfile? existing}) async {
    final saved = await showAppModal<UserProfile?>(
      context: context,
      title: existing == null
          ? (widget.kind == DirectoryKind.staff ? 'Add staff' : 'Add student')
          : 'Edit ${existing.name}',
      child: _PersonForm(
        kind: widget.kind,
        existing: existing,
        students: ref.read(directoryProvider).students,
        staff: ref.read(directoryProvider).staff,
      ),
    );
    if (saved != null && mounted) {
      final controller = ref.read(directoryProvider.notifier);
      if (existing == null) {
        if (widget.kind == DirectoryKind.staff) {
          controller.addStaff(saved);
        } else {
          controller.addStudent(saved);
        }
      } else {
        controller.updatePerson(saved);
      }
    }
  }

  void _showDetail(UserProfile person) {
    showAppModal(
      context: context,
      title: person.name,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(initials: person.avatarInitials, size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(person.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
                    Text('${person.role.label} · ${person.id}',
                        style: TextStyle(
                            fontSize: 12,
                            fontFamily: 'monospace',
                            color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 28),
          _infoRow(context, 'Department', person.department),
          if (person.rollNo != null) _infoRow(context, 'Roll no', person.rollNo!),
          if (person.semester != null) _infoRow(context, 'Semester', person.semester!),
          if (person.batch != null) _infoRow(context, 'Batch', person.batch!),
          if (person.mentorId != null)
            _infoRow(context, 'Mentor', _mentorName(person.mentorId)),
          if (person.designation != null)
            _infoRow(context, 'Designation', person.designation!),
          if (person.subjects != null)
            _infoRow(context, 'Subjects', person.subjects!.join(', ')),
          if (person.phone != null) _infoRow(context, 'Phone', person.phone!),
          if (person.dob != null) _infoRow(context, 'Date of birth', person.dob!),
          if (person.address != null) _infoRow(context, 'Address', person.address!),
          const SizedBox(height: 8),
          _infoRow(context, 'Email', person.email),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _mail(person.email),
                  icon: const Icon(Icons.mail_outline_rounded, size: 18),
                  label: const Text('Contact'),
                ),
              ),
              if (_admin) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).pop();
                      _openPersonForm(existing: person);
                    },
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Edit'),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  void _mail(String email) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Opening mail to $email (demo)')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isStaff = widget.kind == DirectoryKind.staff;
    final data = ref.watch(directoryProvider);
    final source = isStaff ? data.staff : data.students;
    final people = source.where((p) {
      if (_query.isEmpty) return true;
      final q = _query.toLowerCase();
      return p.name.toLowerCase().contains(q) ||
          p.id.toLowerCase().contains(q) ||
          (p.rollNo?.toLowerCase().contains(q) ?? false);
    }).toList();

    return SectionScaffold(
      title: isStaff ? 'Staff directory' : 'Students',
      description: isStaff
          ? 'Faculty and administration across departments.'
          : 'Browse the student body. Tap a card for details.',
      action: _admin
          ? FilledButton.icon(
              onPressed: () => _openPersonForm(),
              icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
              label: const Text('Add'),
            )
          : null,
      children: [
        TextField(
          onChanged: (v) => setState(() => _query = v),
          decoration: const InputDecoration(
            hintText: 'Search by name, ID or roll no…',
            prefixIcon: Icon(Icons.search_rounded, size: 20),
          ),
        ),
        if (people.isEmpty)
          const GlassCard(child: EmptyState(message: 'No one matches your search.'))
        else
          for (final p in people)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                onTap: () => _showDetail(p),
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Avatar(initials: p.avatarInitials, size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name,
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          Text(
                            isStaff
                                ? p.designation ?? p.department
                                : '${p.rollNo ?? p.id} · ${p.semester ?? ''}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    Pill(
                      text: p.id,
                      color: Theme.of(context).extension<AppColors>()!.chart5,
                      compact: true,
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  Widget _infoRow(BuildContext context, String label, String value) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

class _PersonForm extends ConsumerStatefulWidget {
  const _PersonForm({
    required this.kind,
    required this.existing,
    required this.students,
    required this.staff,
  });

  final DirectoryKind kind;
  final UserProfile? existing;
  final List<UserProfile> students;
  final List<UserProfile> staff;

  @override
  ConsumerState<_PersonForm> createState() => _PersonFormState();
}

class _PersonFormState extends ConsumerState<_PersonForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
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
  String? _roleKey;

  bool get _isEdit => widget.existing != null;
  bool get _isStaffForm => widget.kind == DirectoryKind.staff;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _name = TextEditingController(text: e?.name ?? '');
    _email = TextEditingController(text: e?.email ?? '');
    _department = TextEditingController(text: e?.department ?? '');
    _phone = TextEditingController(text: e?.phone ?? '');
    _dob = TextEditingController(text: e?.dob ?? '');
    _address = TextEditingController(text: e?.address ?? '');
    _rollNo = TextEditingController(text: e?.rollNo ?? '');
    _semester = TextEditingController(text: e?.semester ?? '');
    _batch = TextEditingController(text: e?.batch ?? '');
    _mentorId = TextEditingController(text: e?.mentorId ?? '');
    _designation = TextEditingController(text: e?.designation ?? '');
    _subjects = TextEditingController(text: e?.subjects?.join(', ') ?? '');
    _roleKey = e?.roleKeyValue ?? (_isStaffForm ? 'staff' : 'student');
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
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
    super.dispose();
  }

  String _nextId(List<UserProfile> people) {
    final prefix = _isStaffForm ? 'STF-' : 'STU-';
    var maxN = 0;
    for (final p in people) {
      final n = int.tryParse(p.id.replaceFirst(prefix, '')) ?? 0;
      if (n > maxN) maxN = n;
    }
    return '$prefix${maxN + 1}';
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final name = _name.text.trim();
    final initials = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).map((w) => w[0].toUpperCase()).take(2).join();

    final person = widget.existing?.copyWith(
      name: name,
      email: _email.text.trim(),
      avatarInitials: initials,
      department: _department.text.trim(),
      roleKey: _roleKey,
      phone: _phone.text.trim(),
      dob: _dob.text.trim(),
      address: _address.text.trim(),
      rollNo: _rollNo.text.trim(),
      semester: _semester.text.trim(),
      batch: _batch.text.trim(),
      mentorId: _mentorId.text.trim(),
      designation: _designation.text.trim(),
      subjects: _subjects.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
    ) ??
        UserProfile(
          id: _nextId(_isStaffForm ? widget.staff : widget.students),
          name: name,
          role: Role.fromKey(_roleKey!),
          roleKey: _roleKey,
          email: _email.text.trim(),
          avatarInitials: initials,
          department: _department.text.trim(),
          phone: _phone.text.trim(),
          dob: _dob.text.trim(),
          address: _address.text.trim(),
          rollNo: _rollNo.text.trim(),
          semester: _semester.text.trim(),
          batch: _batch.text.trim(),
          mentorId: _mentorId.text.trim(),
          designation: _designation.text.trim(),
          subjects: _subjects.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
        );

    Navigator.of(context).pop(person);
  }

  @override
  Widget build(BuildContext context) {
    final roles = ref.read(rolesProvider).roles;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Full name'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
                labelText: 'Email', helperText: 'Signs in with the default password.'),
            validator: (v) {
              final value = v?.trim() ?? '';
              if (value.isEmpty) return 'Email is required';
              if (!value.contains('@')) return 'Enter a valid email';
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _department,
            decoration: const InputDecoration(labelText: 'Department'),
          ),
          const SizedBox(height: 12),
          InputDecorator(
            decoration: const InputDecoration(labelText: 'Role'),
            child: DropdownButton<String>(
              value: _roleKey,
              isExpanded: true,
              underline: const SizedBox.shrink(),
              items: roles
                  .map((r) => DropdownMenuItem(
                      value: r.key, child: Text('${r.label} (${r.key})')))
                  .toList(),
              onChanged: (v) => setState(() => _roleKey = v),
            ),
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
          if (_isStaffForm) ...[
            const SizedBox(height: 12),
            _field('Designation', _designation),
            const SizedBox(height: 12),
            _field('Subjects (comma separated)', _subjects),
          ] else ...[
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
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _save,
            child: Text(_isEdit ? 'Save changes' : 'Add person'),
          ),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController controller) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
    );
  }
}
