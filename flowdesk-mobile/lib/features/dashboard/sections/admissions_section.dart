import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/utils/logic.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/section_heading.dart';
import '../../../models/admission.dart';
import '../../../providers/admissions_controller.dart';
import 'widgets.dart';

class AdmissionsSection extends ConsumerStatefulWidget {
  const AdmissionsSection({super.key});

  @override
  ConsumerState<AdmissionsSection> createState() => _AdmissionsSectionState();
}

class _AdmissionsSectionState extends ConsumerState<AdmissionsSection> {
  String _filter = 'all';
  final Map<String, TextEditingController> _notes = {};

  @override
  void dispose() {
    for (final c in _notes.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final applications = ref.watch(admissionsProvider);
    final programs = ref.watch(programsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    final list = applications
        .where((a) => _filter == 'all' || a.status.name == _filter)
        .toList();
    final counts = (
      total: applications.length,
      pending: applications
          .where((a) =>
              a.status == AdmissionStatus.submitted ||
              a.status == AdmissionStatus.reviewing)
          .length,
      accepted: applications
          .where((a) => a.status == AdmissionStatus.accepted)
          .length,
    );

    final filters = <String>[
      'all',
      'submitted',
      'reviewing',
      'accepted',
      'rejected',
    ];

    return SectionScaffold(
      title: 'Admissions — Review queue',
      description:
          'Applications for the 2026 intake. Move applications from Submitted → Reviewing → Accepted, or reject with a note.',
      children: [
        CardGrid(children: [
          StatCard(
              label: 'Total applications',
              value: '${counts.total}',
              tone: colors.chart1,
              icon: Icons.description_outlined),
          StatCard(
              label: 'In review',
              value: '${counts.pending}',
              tone: colors.warning,
              icon: Icons.person_add_alt_1_outlined),
          StatCard(
              label: 'Accepted',
              value: '${counts.accepted}',
              tone: colors.success,
              icon: Icons.check_circle_outline_rounded),
        ]),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final f in filters)
              _AdmissionsFilterChip(
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
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(a.applicantName,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 15)),
                                  ),
                                  const SizedBox(width: 8),
                                  _AdmissionsStatusPill(
                                      status: a.status, colors: colors),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${a.id} · ${a.email} · Submitted ${a.submittedAt}',
                                style: TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                    color: scheme.onSurfaceVariant),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(a.programName,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 13)),
                                  ),
                                  Pill(
                                    text: 'Score ${a.score}',
                                    color: colors.chart2,
                                    compact: true,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text('Docs: ${a.docs.join(", ")}',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: scheme.onSurfaceVariant)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (a.status == AdmissionStatus.accepted)
                              Pill(
                                text: programs
                                            .where((p) => p.id == a.programId)
                                            .firstOrNull !=
                                        null
                                    ? 'Fee ${formatINR(programs.where((p) => p.id == a.programId).firstOrNull!.fee)}/yr'
                                    : '',
                                color: colors.success,
                                compact: true,
                              ),
                            if (nextAdmissionStatus(a.status) != null) ...[
                              const SizedBox(height: 6),
                              FilledButton(
                                onPressed: () => _advance(a),
                                style: FilledButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 8),
                                ),
                                child: Text(
                                    'Advance to ${nextAdmissionStatus(a.status)!.label}'),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _notes[a.id] ??
                                (_notes[a.id] =
                                    TextEditingController(text: a.notes)),
                            decoration: const InputDecoration(
                                hintText: 'Add a review note…', isDense: true),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          onPressed: a.status == AdmissionStatus.accepted
                              ? null
                              : () => _accept(a),
                          icon: const Icon(Icons.check_rounded, size: 18),
                          label: const Text('Accept'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: colors.success,
                            side: BorderSide(
                                color: colors.success.withValues(alpha: 0.4)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          onPressed: a.status == AdmissionStatus.rejected
                              ? null
                              : () => _reject(a),
                          icon: const Icon(Icons.close_rounded, size: 18),
                          label: const Text('Reject'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: colors.chart4,
                            side: BorderSide(
                                color: colors.chart4.withValues(alpha: 0.4)),
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

  void _advance(AdmissionApplication a) {
    final next = nextAdmissionStatus(a.status);
    if (next == null) return;
    ref
        .read(admissionsProvider.notifier)
        .update(a.copyWith(
          status: next,
          notes: next == AdmissionStatus.accepted
              ? 'Offer letter ready.'
              : a.notes,
        ));
  }

  void _accept(AdmissionApplication a) {
    ref
        .read(admissionsProvider.notifier)
        .update(a.copyWith(
          status: AdmissionStatus.accepted,
          notes: _notes[a.id]?.text.trim() ?? 'Offer letter ready.',
        ));
  }

  void _reject(AdmissionApplication a) {
    ref
        .read(admissionsProvider.notifier)
        .update(a.copyWith(
          status: AdmissionStatus.rejected,
          notes: _notes[a.id]?.text.trim() ?? a.notes,
        ));
  }

  String _filterLabel(String f) => switch (f) {
        'all' => 'All',
        'submitted' => 'Submitted',
        'reviewing' => 'Reviewing',
        'accepted' => 'Accepted',
        _ => 'Rejected',
      };
}

class _AdmissionsFilterChip extends StatelessWidget {
  const _AdmissionsFilterChip({
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

class _AdmissionsStatusPill extends StatelessWidget {
  const _AdmissionsStatusPill({required this.status, required this.colors});

  final AdmissionStatus status;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      AdmissionStatus.submitted => (colors.chart1, 'Submitted'),
      AdmissionStatus.reviewing => (colors.warning, 'Reviewing'),
      AdmissionStatus.accepted => (colors.success, 'Accepted'),
      AdmissionStatus.rejected => (colors.chart4, 'Rejected'),
    };
    return Pill(text: label, color: color, compact: true);
  }
}
