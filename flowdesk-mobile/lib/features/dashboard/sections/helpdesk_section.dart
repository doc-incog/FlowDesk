import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/tabs.dart';
import '../../../data/helpdesk_data.dart' as helpdesk;
import '../../../models/complaint.dart';
import '../../../models/role.dart';
import '../../../providers/complaints_controller.dart';
import 'widgets.dart';

enum _HelpdeskTab { all, mine, newComplaint }

class HelpdeskSection extends ConsumerStatefulWidget {
  const HelpdeskSection({
    super.key,
    required this.role,
    required this.currentUserName,
  });

  final Role role;
  final String currentUserName;

  @override
  ConsumerState<HelpdeskSection> createState() => _HelpdeskSectionState();
}

class _HelpdeskSectionState extends ConsumerState<HelpdeskSection> {
  _HelpdeskTab _tab = _HelpdeskTab.all;

  @override
  Widget build(BuildContext context) {
    return SectionScaffold(
      title: 'Helpdesk',
      description:
          'Raise complaints and track them to resolution with comments from the concerned office.',
      children: [
        SectionTabs(
          tabs: const [
            _HelpdeskTab.all,
            _HelpdeskTab.mine,
            _HelpdeskTab.newComplaint,
          ],
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: (_HelpdeskTab t) => switch (t) {
            _HelpdeskTab.all => 'All tickets',
            _HelpdeskTab.mine => 'Raised by me',
            _HelpdeskTab.newComplaint => 'Raise a complaint',
          },
        ),
        if (_tab == _HelpdeskTab.newComplaint)
          _NewComplaint(
            role: widget.role,
            raisedByName: widget.currentUserName,
            onCreated: () => setState(() => _tab = _HelpdeskTab.mine),
          )
        else
          _ComplaintList(
            mineOnly: _tab == _HelpdeskTab.mine,
            currentUserName: widget.currentUserName,
            role: widget.role,
          ),
      ],
    );
  }
}

class _NewComplaint extends ConsumerStatefulWidget {
  const _NewComplaint({
    required this.role,
    required this.raisedByName,
    required this.onCreated,
  });

  final Role role;
  final String raisedByName;
  final VoidCallback onCreated;

  @override
  ConsumerState<_NewComplaint> createState() => _NewComplaintState();
}

class _NewComplaintState extends ConsumerState<_NewComplaint> {
  ComplaintCategory _category = ComplaintCategory.academics;
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  void _submit() {
    final subject = _subject.text.trim();
    final description = _description.text.trim();
    if (subject.isEmpty || description.isEmpty) {
      setState(() => _error = 'Subject and description are required.');
      return;
    }
    ref.read(complaintsProvider.notifier).add(Complaint(
          id: 'CMP-${DateTime.now().millisecondsSinceEpoch}',
          category: _category,
          subject: subject,
          description: description,
          status: ComplaintStatus.open,
          createdAt: formatToday(),
          raisedByName: widget.raisedByName,
          raisedByRole: widget.role,
          comments: const [],
        ));
    _subject.clear();
    _description.clear();
    setState(() => _error = null);
    widget.onCreated();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Category',
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in helpdesk.complaintCategories)
                InkWell(
                  onTap: () => setState(() => _category = c),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: _category == c ? colors.chart1 : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: _category == c
                          ? null
                          : Border.all(color: scheme.outline),
                    ),
                    child: Text(
                      c.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _category == c
                            ? scheme.onPrimary
                            : scheme.onSurface,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _subject,
            decoration: const InputDecoration(
                labelText: 'Subject',
                hintText: 'Brief summary of the issue'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 4,
            decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Describe the issue in detail…'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!,
                style: TextStyle(color: colors.chart4, fontSize: 13)),
          ],
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _submit,
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Raise complaint'),
          ),
          const SizedBox(height: 8),
          Text(
            'Your complaint is visible to the relevant office. Typical response time is 24 hours.',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _ComplaintList extends ConsumerWidget {
  const _ComplaintList({
    required this.mineOnly,
    required this.currentUserName,
    required this.role,
  });

  final bool mineOnly;
  final String currentUserName;
  final Role role;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final complaints = ref.watch(complaintsProvider);
    final list =
        complaints.where((c) => mineOnly ? c.raisedByName == currentUserName : true).toList();

    if (list.isEmpty) {
      return const GlassCard(child: EmptyState(message: 'No complaints found.'));
    }

    return Column(
      children: [
        for (final c in list)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _ComplaintCard(
              complaint: c,
              canUpdate: role != Role.student || c.raisedByName == currentUserName,
              currentUserName: currentUserName,
            ),
          ),
      ],
    );
  }
}

class _ComplaintCard extends ConsumerStatefulWidget {
  const _ComplaintCard({
    required this.complaint,
    required this.canUpdate,
    required this.currentUserName,
  });

  final Complaint complaint;
  final bool canUpdate;
  final String currentUserName;

  @override
  ConsumerState<_ComplaintCard> createState() => _ComplaintCardState();
}

class _ComplaintCardState extends ConsumerState<_ComplaintCard> {
  bool _expanded = false;
  final _comment = TextEditingController();

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  void _addComment() {
    final text = _comment.text.trim();
    if (text.isEmpty) return;
    ref.read(complaintsProvider.notifier).addComment(
          widget.complaint.id,
          ComplaintComment(
            id: 'cc${DateTime.now().millisecondsSinceEpoch}',
            author: widget.currentUserName,
            text: text,
            at: formatToday(),
          ),
        );
    _comment.clear();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.complaint;
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Pill(text: c.category.label, color: colors.chart5, compact: true),
              _ComplaintStatusPill(status: c.status, colors: colors),
              Text(
                '${c.id} · ${c.createdAt}',
                style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: scheme.onSurfaceVariant),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(c.subject,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 2),
          Text(c.description,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: scheme.onSurfaceVariant)),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              text: 'Raised by ',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: scheme.onSurfaceVariant),
              children: [
                TextSpan(
                  text: c.raisedByName,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(
                    text: ' (${c.raisedByRole.key})',
                    style: const TextStyle(fontStyle: FontStyle.italic)),
              ],
            ),
          ),
          const Divider(height: 20),
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Icon(Icons.forum_outlined,
                      size: 16, color: colors.chart1),
                  const SizedBox(width: 6),
                  Text(
                    '${c.comments.length} comment${c.comments.length == 1 ? "" : "s"}',
                    style: TextStyle(
                        color: colors.chart1, fontWeight: FontWeight.w600),
                  ),
                  const Spacer(),
                  Icon(_expanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                      size: 18, color: scheme.onSurfaceVariant),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const SizedBox(height: 10),
            for (final cm in c.comments)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerHighest.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: scheme.outlineVariant),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(cm.author,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                          ),
                          Text(cm.at,
                              style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 10,
                                  color: scheme.onSurfaceVariant)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(cm.text,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ),
            if (widget.canUpdate) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _comment,
                      decoration: const InputDecoration(
                          hintText: 'Add a comment…', isDense: true),
                      onSubmitted: (_) => _addComment(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _addComment,
                    icon: Icon(Icons.send_rounded, color: colors.chart1),
                    tooltip: 'Send comment',
                  ),
                ],
              ),
              if (c.status != ComplaintStatus.resolved) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: () => ref
                        .read(complaintsProvider.notifier)
                        .markResolved(c.id),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Mark resolved'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colors.success,
                      side: BorderSide(
                          color: colors.success.withValues(alpha: 0.4)),
                    ),
                  ),
                ),
              ],
            ],
          ],
        ],
      ),
    );
  }
}

class _ComplaintStatusPill extends StatelessWidget {
  const _ComplaintStatusPill({required this.status, required this.colors});

  final ComplaintStatus status;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      ComplaintStatus.open => (colors.chart4, 'Open'),
      ComplaintStatus.inProgress => (colors.warning, 'In progress'),
      ComplaintStatus.resolved => (colors.success, 'Resolved'),
    };
    return Pill(text: label, color: color, compact: true);
  }
}
