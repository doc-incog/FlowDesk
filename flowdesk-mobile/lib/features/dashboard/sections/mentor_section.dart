import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/role.dart';
import 'widgets.dart';

class MentorSection extends StatelessWidget {
  const MentorSection({super.key, required this.role, required this.mentorId});

  final Role role;
  final String? mentorId;

  @override
  Widget build(BuildContext context) {
    if (role == Role.staff) {
      final mentees = mock.students.where((s) => s.mentorId == 'MEN-01').toList();
      return SectionScaffold(
        title: 'My mentees',
        description: 'Students under your guidance this semester.',
        children: [
          CardGrid(
            children: [
              for (final m in mentees)
                GlassCard(
                  child: Row(
                    children: [
                      Avatar(initials: m.avatarInitials, size: 42),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.name,
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(m.rollNo ?? m.id,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant)),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => _mail(context, m.email),
                        icon: const Icon(Icons.mail_outline_rounded, size: 20),
                        tooltip: 'Email ${m.name}',
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      );
    }

    final mentor = mock.mentors.firstWhere(
      (m) => m.id == (mentorId ?? 'MEN-01'),
      orElse: () => mock.mentors.first,
    );

    return SectionScaffold(
      title: 'My Mentor',
      description: 'Your academic guide for this semester.',
      children: [
        GlassCard(
          child: Column(
            children: [
              Row(
                children: [
                  Avatar(initials: mentor.avatarInitials, size: 56),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(mentor.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 17)),
                        Text(mentor.designation,
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  Pill(
                    text: '${mentor.mentees} mentees',
                    color: Theme.of(context).extension<AppColors>()!.chart2,
                    compact: true,
                  ),
                ],
              ),
              const Divider(height: 28),
              _infoRow(context, 'Email', mentor.email),
              _infoRow(context, 'Phone', mentor.phone),
              _infoRow(context, 'Office', mentor.office),
              _infoRow(context, 'Office hours', mentor.officeHours),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {},
                      child: const Text('Book a meeting'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _mail(context, mentor.email),
                      icon: const Icon(Icons.mail_outline_rounded, size: 18),
                      label: const Text('Message'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _mail(BuildContext context, String email) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Opening mail to $email (demo)')),
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
