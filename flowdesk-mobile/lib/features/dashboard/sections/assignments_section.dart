import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../core/widgets/tabs.dart';
import '../../../core/widgets/file_upload.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/assignment.dart';
import '../../../models/role.dart';
import '../../../providers/assignments_controller.dart';
import 'widgets.dart';

enum _AssignmentsTab { mytasks, submissions, manage }

class AssignmentsSection extends ConsumerStatefulWidget {
  const AssignmentsSection({super.key, required this.role});

  final Role role;

  @override
  ConsumerState<AssignmentsSection> createState() => _AssignmentsSectionState();
}

class _AssignmentsSectionState extends ConsumerState<AssignmentsSection> {
  _AssignmentsTab _tab = _AssignmentsTab.submissions;

  List<_AssignmentsTab> get _tabs => widget.role == Role.student
      ? const [_AssignmentsTab.mytasks]
      : const [_AssignmentsTab.submissions, _AssignmentsTab.manage];

  String _label(_AssignmentsTab t) => switch (t) {
        _AssignmentsTab.mytasks => 'My tasks',
        _AssignmentsTab.submissions => 'Submissions',
        _AssignmentsTab.manage => 'Manage assignments',
      };

  @override
  void initState() {
    super.initState();
    if (widget.role == Role.student) _tab = _AssignmentsTab.mytasks;
  }

  @override
  Widget build(BuildContext context) {
    return SectionScaffold(
      title: 'Assignments',
      description: 'Track submissions, due dates and grades in one place.',
      children: [
        SectionTabs(
          tabs: _tabs,
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: _label,
        ),
        switch (_tab) {
          _AssignmentsTab.mytasks => const _MyTasks(),
          _AssignmentsTab.submissions => const _GradeSubmissions(),
          _AssignmentsTab.manage => const _ManageAssignments(),
        },
      ],
    );
  }
}

class _MyTasks extends ConsumerStatefulWidget {
  const _MyTasks();

  @override
  ConsumerState<_MyTasks> createState() => _MyTasksState();
}

class _MyTasksState extends ConsumerState<_MyTasks> {
  Assignment? _uploadFor;
  String _fileName = '';

  void _submit() {
    if (_uploadFor == null || _fileName.isEmpty) return;
    final me = mock.demoUsers[Role.student]!;
    ref.read(submissionsProvider.notifier).submit(Submission(
          id: 'SU${DateTime.now().millisecondsSinceEpoch}',
          assignmentId: _uploadFor!.id,
          studentId: me.id,
          studentName: me.name,
          submittedAt: formatToday(),
          fileName: _fileName,
        ));
    setState(() {
      _fileName = '';
      _uploadFor = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final assignments = ref.watch(assignmentsProvider);
    final submissions = ref.watch(submissionsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final me = mock.demoUsers[Role.student]!;

    final items = assignments.map((a) {
      final sub = submissions
          .where((s) => s.assignmentId == a.id && s.studentId == me.id)
          .firstOrNull;
      final AssignmentStatus status;
      if (sub?.marks != null) {
        status = AssignmentStatus.graded;
      } else if (sub != null) {
        status = AssignmentStatus.submitted;
      } else if (daysUntil(a.dueDate) < 0) {
        status = AssignmentStatus.overdue;
      } else {
        status = AssignmentStatus.pending;
      }
      return (assignment: a, sub: sub, status: status);
    }).toList()
      ..sort((x, y) =>
          _statusOrder(x.status).compareTo(_statusOrder(y.status)));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(item.assignment.title,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15)),
                      ),
                      _StatusChip(status: item.status, colors: colors),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${item.assignment.moduleName} (${item.assignment.moduleCode}) · Due ${item.assignment.dueDate}',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 14,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _MetaLine(
                        icon: Icons.calendar_month_outlined,
                        text: _dueText(item.assignment, item.status),
                      ),
                      _MetaLine(
                        icon: Icons.description_outlined,
                        text: 'Max ${item.assignment.maxMarks} marks',
                      ),
                      if (item.sub?.fileName != null)
                        _MetaLine(
                          icon: Icons.attach_file_rounded,
                          text: item.sub!.fileName,
                        ),
                    ],
                  ),
                  if (item.sub?.marks != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: colors.success.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          Text(
                            '${item.sub!.marks} / ${item.assignment.maxMarks}',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: colors.success,
                            ),
                          ),
                          if (item.sub!.feedback.isNotEmpty) ...[
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(item.sub!.feedback,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: scheme.onSurfaceVariant)),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  if (item.status == AssignmentStatus.pending ||
                      item.status == AssignmentStatus.overdue) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton.icon(
                        onPressed: () => _openUpload(context, item.assignment),
                        icon: const Icon(Icons.upload_rounded, size: 18),
                        label: const Text('Submit'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _openUpload(BuildContext context, Assignment a) async {
    await showAppModal(
      context: context,
      title: 'Submit — ${a.title}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Attach your solution for ${a.moduleName}. Deadline: ${a.dueDate}.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          MockFileUpload(
            label: 'Attach solution file',
            onSelect: (name) => setState(() => _fileName = name),
          ),
          if (_fileName.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Attached: $_fileName',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(fontFamily: 'monospace')),
          ],
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _fileName.isEmpty ? null : _submit,
            icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
            label: const Text('Submit assignment'),
          ),
        ],
      ),
    );
  }

  String _dueText(Assignment a, AssignmentStatus status) {
    final days = daysUntil(a.dueDate);
    return switch (status) {
      AssignmentStatus.overdue => '${days.abs()}d overdue',
      AssignmentStatus.pending =>
        days == 0 ? 'Due today' : '$days days left',
      _ => 'Submitted',
    };
  }

  int _statusOrder(AssignmentStatus s) => switch (s) {
        AssignmentStatus.overdue => 0,
        AssignmentStatus.pending => 1,
        AssignmentStatus.submitted => 2,
        AssignmentStatus.graded => 3,
      };
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: scheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(text,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant)),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status, required this.colors});

  final AssignmentStatus status;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      AssignmentStatus.pending => (colors.chart1, 'Pending'),
      AssignmentStatus.overdue => (colors.chart4, 'Overdue'),
      AssignmentStatus.submitted => (colors.chart2, 'Submitted'),
      AssignmentStatus.graded => (colors.success, 'Graded'),
    };
    return Pill(text: label, color: color, compact: true);
  }
}

class _GradeSubmissions extends ConsumerStatefulWidget {
  const _GradeSubmissions();

  @override
  ConsumerState<_GradeSubmissions> createState() => _GradeSubmissionsState();
}

class _GradeSubmissionsState extends ConsumerState<_GradeSubmissions> {
  String? _assignmentId;
  final Map<String, TextEditingController> _marks = {};
  final Map<String, TextEditingController> _feedback = {};

  void _initFor(String? id) {
    final subs = ref
        .read(submissionsProvider)
        .where((s) => s.assignmentId == id)
        .toList();
    _marks.clear();
    _feedback.clear();
    for (final s in subs) {
      _marks[s.id] = TextEditingController(text: s.marks?.toString() ?? '');
      _feedback[s.id] = TextEditingController(text: s.feedback);
    }
  }

  @override
  void dispose() {
    for (final c in _marks.values) {
      c.dispose();
    }
    for (final c in _feedback.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final assignments = ref.watch(assignmentsProvider);
    final submissions = ref.watch(submissionsProvider);
    final list = submissions
        .where((s) => s.assignmentId == _assignmentId)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _assignmentId,
          hint: const Text('Select an assignment'),
          items: [
            for (final a in assignments)
              DropdownMenuItem(
                  value: a.id,
                  child: Text('${a.moduleCode} · ${a.title}')),
          ],
          onChanged: (v) {
            setState(() => _assignmentId = v);
            _initFor(v);
          },
        ),
        const SizedBox(height: 14),
        if (list.isEmpty)
          const GlassCard(
              child: EmptyState(message: 'No submissions yet for this assignment.'))
        else
          for (final s in list)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(s.studentName,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(
                      '${s.fileName} · Submitted ${s.submittedAt}',
                      style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                    if (s.feedback.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(s.feedback,
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _marks[s.id],
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(3),
                            ],
                            decoration: const InputDecoration(
                                labelText: 'Marks', isDense: true),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: TextField(
                            controller: _feedback[s.id],
                            decoration: const InputDecoration(
                                labelText: 'Feedback', isDense: true),
                          ),
                        ),
                        const SizedBox(width: 10),
                        FilledButton(
                          onPressed: () {
                            ref
                                .read(submissionsProvider.notifier)
                                .grade(
                                  s.id,
                                  int.tryParse(_marks[s.id]?.text ?? '') ?? 0,
                                  _feedback[s.id]?.text ?? '',
                                );
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content:
                                      Text('Marks saved for ${s.studentName}.')),
                            );
                          },
                          child: const Text('Save'),
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
}

class _ManageAssignments extends ConsumerStatefulWidget {
  const _ManageAssignments();

  @override
  ConsumerState<_ManageAssignments> createState() => _ManageAssignmentsState();
}

class _ManageAssignmentsState extends ConsumerState<_ManageAssignments> {
  final _formKey = GlobalKey<FormState>();
  String? _moduleCode;
  String? _moduleName;
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _dueDate = TextEditingController();
  final _maxMarks = TextEditingController(text: '20');

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _dueDate.dispose();
    _maxMarks.dispose();
    super.dispose();
  }

  void _add() {
    if (!_formKey.currentState!.validate()) return;
    final a = Assignment(
      id: 'A${DateTime.now().millisecondsSinceEpoch}',
      moduleCode: _moduleCode!,
      moduleName: _moduleName ?? _moduleCode!,
      title: _title.text.trim(),
      description: _description.text.trim(),
      assignedDate: formatToday(),
      dueDate: _dueDate.text.trim(),
      maxMarks: int.tryParse(_maxMarks.text) ?? 20,
    );
    ref.read(assignmentsProvider.notifier).add(a);
    _title.clear();
    _description.clear();
    _dueDate.clear();
    _maxMarks.text = '20';
    setState(() => _moduleCode = null);
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Assignment created.')));
  }

  @override
  Widget build(BuildContext context) {
    final assignments = ref.watch(assignmentsProvider);
    final modules = <String, String>{};
    for (final s in mock.schedule) {
      modules.putIfAbsent(s.code, () => s.module);
    }
    final colors = Theme.of(context).extension<AppColors>()!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GlassCard(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Create assignment',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _moduleCode,
                  hint: const Text('Module'),
                  items: [
                    for (final e in modules.entries)
                      DropdownMenuItem(
                          value: e.key, child: Text('${e.key} · ${e.value}')),
                  ],
                  onChanged: (v) => setState(() {
                    _moduleCode = v;
                    _moduleName = v == null ? null : modules[v];
                  }),
                  validator: (v) => v == null ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _title,
                  decoration: const InputDecoration(labelText: 'Title'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _description,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _dueDate,
                        decoration: const InputDecoration(
                            labelText: 'Due date (yyyy-mm-dd)'),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _maxMarks,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: const InputDecoration(labelText: 'Max marks'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _add,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Create assignment'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('All assignments',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 8),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final a in assignments)
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(a.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            Text(
                              '${a.moduleCode} · Due ${a.dueDate} · ${a.maxMarks} marks',
                              style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => ref
                            .read(assignmentsProvider.notifier)
                            .delete(a.id),
                        icon: Icon(Icons.delete_outline_rounded,
                            size: 20, color: colors.chart4),
                        tooltip: 'Delete',
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
