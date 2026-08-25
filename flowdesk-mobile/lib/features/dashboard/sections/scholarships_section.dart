import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../core/widgets/file_upload.dart';
import '../../../core/widgets/section_heading.dart';
import '../../../core/widgets/tabs.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/role.dart';
import '../../../models/scholarship.dart';
import '../../../providers/scholarships_controller.dart';
import 'widgets.dart';

enum _ScholarshipsTab { browse, applications }

class ScholarshipsSection extends ConsumerStatefulWidget {
  const ScholarshipsSection({super.key, required this.role});

  final Role role;

  @override
  ConsumerState<ScholarshipsSection> createState() =>
      _ScholarshipsSectionState();
}

class _ScholarshipsSectionState extends ConsumerState<ScholarshipsSection> {
  _ScholarshipsTab _tab = _ScholarshipsTab.browse;

  void _openApply(Scholarship s) {
    showAppModal(
      context: context,
      title: 'Apply — ${s.name}',
      child: _ApplySheet(scholarship: s),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.role == Role.admin) {
      return const _AdminScholarships();
    }

    final isStudent = widget.role == Role.student;
    return SectionScaffold(
      title: 'Scholarships',
      description:
          'Merit, need-based and sports scholarships offered across programmes.',
      children: [
        SectionTabs(
          tabs: const [_ScholarshipsTab.browse, _ScholarshipsTab.applications],
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: (t) =>
              t == _ScholarshipsTab.browse ? 'Browse & apply' : 'My applications',
        ),
        if (_tab == _ScholarshipsTab.browse)
          _BrowseGrid(canApply: isStudent, onApply: _openApply)
        else
          const _StudentApplications(),
        if (!isStudent)
          Text(
            'Students can apply from the Scholarships section. Staff can view the programme details above.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
      ],
    );
  }
}

class _BrowseGrid extends ConsumerWidget {
  const _BrowseGrid({required this.canApply, required this.onApply});

  final bool canApply;
  final ValueChanged<Scholarship> onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scholarships = ref.watch(scholarshipsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final s in scholarships)
              SizedBox(
                width: width,
                child: GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: colors.chart3.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        alignment: Alignment.center,
                        child: Icon(Icons.emoji_events_outlined,
                            size: 22, color: colors.chart3),
                      ),
                      const SizedBox(height: 10),
                      Text(s.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                      Text(s.provider,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(
                                  color:
                                      Theme.of(context).colorScheme.onSurfaceVariant)),
                      const SizedBox(height: 10),
                      _DetailRow('Amount', formatINR(s.amount), accent: true),
                      _DetailRow('Eligibility', s.eligibility),
                      _DetailRow('Seats', '${s.seats}'),
                      _DetailRow('Deadline', s.deadline),
                      const SizedBox(height: 8),
                      Text(s.description,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: canApply ? () => onApply(s) : null,
                          child: const Text('Apply'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value, {this.accent = false});

  final String label;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label,
                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontFamily: accent ? 'monospace' : null,
                fontWeight: accent ? FontWeight.w700 : FontWeight.w500,
                color: accent
                    ? Theme.of(context).extension<AppColors>()!.chart1
                    : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentApplications extends ConsumerWidget {
  const _StudentApplications();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final applications = ref.watch(scholarshipApplicationsProvider);
    final scholarships = ref.watch(scholarshipsProvider);
    final me = mock.demoUsers[Role.student]!;
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final mine = applications.where((a) => a.studentId == me.id).toList();

    if (mine.isEmpty) {
      return const GlassCard(
          child: EmptyState(
              message: "You haven't applied for any scholarships yet."));
    }

    return Column(
      children: [
        for (final a in mine)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          scholarships
                                  .where((s) => s.id == a.scholarshipId)
                                  .firstOrNull
                                  ?.name ??
                              a.id,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${a.id} · Submitted ${a.submittedAt} · Docs: ${a.docs.join(", ")}',
                          style:
                              TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  _StatusPill(status: a.status, colors: colors),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _ApplySheet extends ConsumerStatefulWidget {
  const _ApplySheet({required this.scholarship});

  final Scholarship scholarship;

  @override
  ConsumerState<_ApplySheet> createState() => _ApplySheetState();
}

class _ApplySheetState extends ConsumerState<_ApplySheet> {
  final List<String> _docs = [];
  bool _submitted = false;

  void _submit() {
    final me = mock.demoUsers[Role.student]!;
    ref
        .read(scholarshipApplicationsProvider.notifier)
        .apply(ScholarshipApplication(
          id: 'SA-${DateTime.now().millisecondsSinceEpoch}',
          scholarshipId: widget.scholarship.id,
          studentId: me.id,
          studentName: me.name,
          status: ScholarshipStatus.submitted,
          submittedAt: formatToday(),
          docs: _docs,
        ));
    setState(() => _submitted = true);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = widget.scholarship;

    if (_submitted) {
      return SuccessPanel(
        title: 'Application submitted',
        subtitle: '${s.name} · Track the status under "My applications".',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              _ApplyRow('Amount', formatINR(s.amount), mono: true),
              _ApplyRow('Eligibility', s.eligibility),
              _ApplyRow('Deadline', s.deadline),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('Supporting documents',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        MockFileUpload(
          label: 'Attach transcript, certificate or income proof',
          onSelect: (name) => setState(() => _docs.add(name)),
        ),
        if (_docs.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('Attached: ${_docs.join(", ")}',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(fontFamily: 'monospace')),
        ],
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.add_rounded, size: 18),
          label: const Text('Submit application'),
        ),
        const SizedBox(height: 8),
        Text(
          'Review typically completes within 2 weeks. Track status in "My applications".',
          textAlign: TextAlign.center,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _ApplyRow extends StatelessWidget {
  const _ApplyRow(this.label, this.value, {this.mono = false});

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                style: TextStyle(
                    fontSize: 13,
                    fontFamily: mono ? 'monospace' : null,
                    fontWeight: mono ? FontWeight.w700 : FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

class _AdminScholarships extends ConsumerStatefulWidget {
  const _AdminScholarships();

  @override
  ConsumerState<_AdminScholarships> createState() =>
      _AdminScholarshipsState();
}

class _AdminScholarshipsState extends ConsumerState<_AdminScholarships> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final applications = ref.watch(scholarshipApplicationsProvider);
    final scholarships = ref.watch(scholarshipsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    final list = applications
        .where((a) => _filter == 'all' || a.status.name == _filter)
        .toList();
    final counts = (
      total: applications.length,
      pending: applications
          .where((a) =>
              a.status == ScholarshipStatus.submitted ||
              a.status == ScholarshipStatus.underReview)
          .length,
      approved: applications
          .where((a) => a.status == ScholarshipStatus.approved)
          .length,
    );

    final filters = <String>[
      'all',
      'submitted',
      'underReview',
      'approved',
      'rejected',
    ];

    return SectionScaffold(
      title: 'Scholarship applications',
      description:
          'Review and approve scholarship applications from the review queue.',
      children: [
        CardGrid(children: [
          StatCard(
              label: 'Total applications',
              value: '${counts.total}',
              tone: colors.chart1,
              icon: Icons.description_outlined),
          StatCard(
              label: 'Pending review',
              value: '${counts.pending}',
              tone: colors.warning,
              icon: Icons.schedule_rounded),
          StatCard(
              label: 'Approved',
              value: '${counts.approved}',
              tone: colors.success,
              icon: Icons.check_circle_outline_rounded),
        ]),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final f in filters)
              _FilterChip(
                label: _filterLabel(f),
                selected: _filter == f,
                onTap: () => setState(() => _filter = f),
              ),
          ],
        ),
        if (list.isEmpty)
          const GlassCard(
              child: EmptyState(message: 'No applications in this view.'))
        else
          for (final a in list)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(a.studentName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        _StatusPill(status: a.status, colors: colors),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Builder(builder: (context) {
                      final s = scholarships
                          .where((x) => x.id == a.scholarshipId)
                          .firstOrNull;
                      return Text(
                        '${a.id} · ${s?.name ?? a.scholarshipId}'
                        '${s != null ? ' · ${formatINR(s.amount)}' : ''}',
                        style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: scheme.onSurfaceVariant),
                      );
                    }),
                    const SizedBox(height: 2),
                    Text('Submitted ${a.submittedAt} · ${a.docs.join(", ")}',
                        style: TextStyle(
                            fontSize: 12, color: scheme.onSurfaceVariant)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: a.status == ScholarshipStatus.approved
                                ? null
                                : () => ref
                                    .read(scholarshipApplicationsProvider
                                        .notifier)
                                    .setStatus(
                                        a.id, ScholarshipStatus.approved),
                            icon: const Icon(Icons.check_rounded, size: 18),
                            label: const Text('Approve'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: colors.success,
                              side: BorderSide(
                                  color:
                                      colors.success.withValues(alpha: 0.4)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: a.status == ScholarshipStatus.rejected
                                ? null
                                : () => ref
                                    .read(scholarshipApplicationsProvider
                                        .notifier)
                                    .setStatus(a.id, ScholarshipStatus.rejected),
                            icon: const Icon(Icons.close_rounded, size: 18),
                            label: const Text('Reject'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: colors.chart4,
                              side: BorderSide(
                                  color:
                                      colors.chart4.withValues(alpha: 0.4)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  String _filterLabel(String f) => switch (f) {
        'all' => 'All',
        'submitted' => 'Submitted',
        'underReview' => 'Under review',
        'approved' => 'Approved',
        _ => 'Rejected',
      };
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? colors.chart1 : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: selected ? null : Border.all(color: scheme.outline),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? scheme.onPrimary : scheme.onSurface,
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status, required this.colors});

  final ScholarshipStatus status;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      ScholarshipStatus.submitted => (colors.chart1, 'Submitted'),
      ScholarshipStatus.underReview => (colors.warning, 'Under review'),
      ScholarshipStatus.approved => (colors.success, 'Approved'),
      ScholarshipStatus.rejected => (colors.chart4, 'Rejected'),
    };
    return Pill(text: label, color: color, compact: true);
  }
}
