import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/utils/logic.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../core/widgets/rating_stars.dart';
import '../../../core/widgets/tabs.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/feedback.dart';
import '../../../models/role.dart';
import '../../../providers/feedback_controller.dart';
import 'widgets.dart';

typedef _Filter = String; // 'all' | 'teacher' | 'event'

class FeedbackSection extends ConsumerStatefulWidget {
  const FeedbackSection({super.key});

  @override
  ConsumerState<FeedbackSection> createState() => _FeedbackSectionState();
}

class _FeedbackSectionState extends ConsumerState<FeedbackSection> {
  _Filter _filter = 'all';

  void _openRate(FeedbackTarget t) {
    showAppModal(
      context: context,
      title: 'Rate — ${t.name}',
      child: _RateSheet(target: t),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final targets = ref.watch(feedbackTargetsProvider);

    return SectionScaffold(
      title: 'Feedback',
      description:
          'Rate your teachers and campus events. Responses help improve quality — aggregated views for faculty.',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final f in const ['all', 'teacher', 'event'])
              _FeedbackFilterChip(
                label: f == 'all' ? 'All' : f == 'teacher' ? 'Teacher' : 'Event',
                selected: _filter == f,
                onTap: () => setState(() => _filter = f),
              ),
          ],
        ),
        _FeedbackGrid(
          filter: _filter,
          colors: colors,
          onRate: _openRate,
        ),
        _RatingDistribution(targets: targets, colors: colors),
      ],
    );
  }
}

class _FeedbackFilterChip extends StatelessWidget {
  const _FeedbackFilterChip({
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

class _FeedbackGrid extends ConsumerWidget {
  const _FeedbackGrid({
    required this.filter,
    required this.colors,
    required this.onRate,
  });

  final _Filter filter;
  final AppColors colors;
  final ValueChanged<FeedbackTarget> onRate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final targets = ref.watch(feedbackTargetsProvider);
    final entries = ref.watch(feedbackProvider);
    final list = targets
        .where((t) => filter == 'all' || t.type.name == filter)
        .toList();
    final scheme = Theme.of(context).colorScheme;

    return ResponsiveGrid(
      children: [
        for (final t in list)
          GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(t.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                          ),
                          const SizedBox(width: 8),
                          _AveragePill(
                            avg: averageRating(entries, t.id),
                            colors: colors,
                          ),
                        ],
                      ),
                      Text(
                        '${t.type == FeedbackTargetType.teacher ? 'Teacher' : 'Event'} · ${t.subtitle}',
                        style: TextStyle(
                            fontSize: 12, color: scheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 10),
                      RatingStars(
                          value: averageRating(entries, t.id).round(),
                          size: 18),
                      const SizedBox(height: 4),
                      Text(
                        '${entries.where((e) => e.targetId == t.id).length} '
                        'rating${entries.where((e) => e.targetId == t.id).length == 1 ? "" : "s"}',
                        style: TextStyle(
                            fontSize: 12, color: scheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => onRate(t),
                          icon: const Icon(Icons.star_outline_rounded, size: 18),
                          label: const Text('Rate'),
                        ),
                      ),
                    ],
                  ),
      ],
    );
  }
}

class _AveragePill extends StatelessWidget {
  const _AveragePill({required this.avg, required this.colors});

  final double avg;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return Pill(
      text: avg > 0 ? avg.toStringAsFixed(1) : '—',
      color: colors.chart1,
      compact: true,
    );
  }
}

class _RateSheet extends ConsumerStatefulWidget {
  const _RateSheet({required this.target});

  final FeedbackTarget target;

  @override
  ConsumerState<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends ConsumerState<_RateSheet> {
  int _rating = 5;
  final _comment = TextEditingController();
  bool _submitted = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  void _submit() {
    final me = mock.demoUsers[Role.student]!;
    ref.read(feedbackProvider.notifier).add(FeedbackEntry(
          id: 'F${DateTime.now().millisecondsSinceEpoch}',
          targetId: widget.target.id,
          rating: _rating,
          comment: _comment.text.trim(),
          byName: me.name,
          createdAt: formatToday(),
        ));
    setState(() => _submitted = true);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    if (_submitted) {
      return SuccessPanel(
        title: 'Thank you for your feedback!',
        subtitle: 'Your rating for ${widget.target.name} has been recorded.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            children: [
              RatingStars(
                value: _rating,
                onChanged: (v) => setState(() => _rating = v),
                size: 32,
              ),
              const SizedBox(height: 6),
              Text(ratingLabel(_rating),
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _comment,
          maxLines: 3,
          decoration: const InputDecoration(
              hintText: "Anything specific you'd like to add? (optional)"),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.rate_review_outlined, size: 18),
          label: const Text('Submit feedback'),
        ),
        const SizedBox(height: 8),
        Text(
          'Feedback is shown aggregated — individual responses are anonymous to faculty.',
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

class _RatingDistribution extends ConsumerWidget {
  const _RatingDistribution({required this.targets, required this.colors});

  final List<FeedbackTarget> targets;
  final AppColors colors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(feedbackProvider);
    final scheme = Theme.of(context).colorScheme;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rating distribution',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text('How ratings are spread across targets (average of 1–5).',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: scheme.onSurfaceVariant)),
          const SizedBox(height: 14),
          for (final t in targets)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  SizedBox(
                    width: 120,
                    child: Text(t.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13)),
                  ),
                  Expanded(
                    child: ProgressBar(
                      value: averageRating(entries, t.id) / 5 * 100,
                      color: colors.chart1,
                      height: 8,
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 44,
                    child: Text(
                      averageRating(entries, t.id) > 0
                          ? '${averageRating(entries, t.id).toStringAsFixed(1)}★'
                          : '—',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: scheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
