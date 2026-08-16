import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/role.dart';
import '../../../models/user.dart';
import 'widgets.dart';

enum DirectoryKind { students, staff }

class DirectorySection extends StatefulWidget {
  const DirectorySection({super.key, required this.kind, required this.role});

  final DirectoryKind kind;
  final Role role;

  @override
  State<DirectorySection> createState() => _DirectorySectionState();
}

class _DirectorySectionState extends State<DirectorySection> {
  String _query = '';

  String _mentorName(String? mentorId) {
    if (mentorId == null) return '—';
    final mentor = mock.mentors.where((m) => m.id == mentorId).toList();
    return mentor.isEmpty ? '—' : mentor.first.name;
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
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
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
          if (person.mentorId != null)
            _infoRow(context, 'Mentor', _mentorName(person.mentorId)),
          if (person.designation != null)
            _infoRow(context, 'Designation', person.designation!),
          if (person.subjects != null)
            _infoRow(context, 'Subjects', person.subjects!.join(', ')),
          const SizedBox(height: 8),
          _infoRow(context, 'Email', person.email),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _mail(person.email),
              icon: const Icon(Icons.mail_outline_rounded, size: 18),
              label: const Text('Contact'),
            ),
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
    final people = (isStaff ? mock.staff : mock.students).where((p) {
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
