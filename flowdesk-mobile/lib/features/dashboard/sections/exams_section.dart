import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/grades.dart';
import '../../../core/utils/logic.dart';
import '../../../core/utils/pdf_export.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/section_heading.dart';
import '../../../core/widgets/tabs.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/exam.dart';
import '../../../models/role.dart';
import '../../../models/user.dart';
import '../../../providers/exams_controller.dart';
import 'widgets.dart';

enum _ExamsTab { schedule, seating, marks, results, manage }

class ExamsSection extends ConsumerStatefulWidget {
  const ExamsSection({super.key, required this.role});

  final Role role;

  @override
  ConsumerState<ExamsSection> createState() => _ExamsSectionState();
}

class _ExamsSectionState extends ConsumerState<ExamsSection> {
  _ExamsTab _tab = _ExamsTab.schedule;

  List<_ExamsTab> get _tabs => switch (widget.role) {
        Role.student => const [_ExamsTab.schedule, _ExamsTab.seating, _ExamsTab.results],
        Role.staff => const [_ExamsTab.schedule, _ExamsTab.marks, _ExamsTab.results],
        Role.admin => const [
            _ExamsTab.schedule,
            _ExamsTab.marks,
            _ExamsTab.results,
            _ExamsTab.manage,
          ],
      };

  String _label(_ExamsTab t) => switch (t) {
        _ExamsTab.schedule => 'Exam schedule',
        _ExamsTab.seating => 'My seating',
        _ExamsTab.marks => 'Mark entry',
        _ExamsTab.results => 'All results',
        _ExamsTab.manage => 'Manage exams',
      };

  @override
  Widget build(BuildContext context) {
    return SectionScaffold(
      title: 'Exams & Results',
      description: 'Schedules, seating, mark entry and report cards.',
      children: [
        SectionTabs(
          tabs: _tabs,
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: _label,
        ),
        switch (_tab) {
          _ExamsTab.schedule => _ExamSchedule(),
          _ExamsTab.seating => _SeatingView(),
          _ExamsTab.marks => _MarkEntry(),
          _ExamsTab.results => _AllResults(role: widget.role),
          _ExamsTab.manage => const _ManageExams(),
        },
      ],
    );
  }
}

class _ExamSchedule extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final exams = ref.watch(examsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    Color typeColor(ExamType t) => switch (t) {
          ExamType.midterm => colors.chart2,
          ExamType.finalTerm => colors.chart1,
          ExamType.practical => colors.chart3,
        };

    return Column(
      children: [
        for (final e in exams)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 4,
                    height: 56,
                    decoration: BoxDecoration(
                      color: typeColor(e.type),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(e.moduleName,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700, fontSize: 15)),
                            ),
                            Pill(
                              text: e.type.label.toUpperCase(),
                              color: typeColor(e.type),
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text('${e.moduleCode} · ${e.title}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: scheme.onSurfaceVariant)),
                        const SizedBox(height: 6),
                        Text(
                          '${e.date}  ·  ${e.start}–${e.end}  ·  ${e.room}  ·  Max ${e.maxMarks}',
                          style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _SeatingView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_SeatingView> createState() => _SeatingViewState();
}

class _SeatingViewState extends ConsumerState<_SeatingView> {
  String? _examId;

  @override
  Widget build(BuildContext context) {
    final exams = ref.watch(examsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final exam = _examId == null
        ? null
        : exams.where((e) => e.id == _examId).firstOrNull;
    final me = mock.demoUsers[Role.student]!;
    final mySeat = seatFor(me.id);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _examId,
          hint: const Text('Select an exam'),
          items: [
            for (final e in exams)
              DropdownMenuItem(value: e.id, child: Text('${e.moduleCode} — ${e.title}')),
          ],
          onChanged: (v) => setState(() => _examId = v),
        ),
        const SizedBox(height: 14),
        if (exam == null)
          const GlassCard(child: EmptyState(message: 'Pick an exam to see your seat.'))
        else ...[
          GlassCard(
            color: colors.chart1.withValues(alpha: 0.06),
            child: Row(
              children: [
                Icon(Icons.event_seat_rounded, color: colors.chart1),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${exam.moduleName} · ${exam.room}',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('Your seat is #$mySeat in the exam hall layout below.',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.chart1,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text('$mySeat',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (var i = 1; i <= 5; i++)
                Container(
                  width: (MediaQuery.of(context).size.width - 60) / 5,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == mySeat
                        ? colors.chart1
                        : scheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                    border: i == mySeat
                        ? null
                        : Border.all(color: scheme.outlineVariant),
                  ),
                  child: Text(
                    '$i',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: i == mySeat ? Colors.white : scheme.onSurface,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _MarkEntry extends ConsumerStatefulWidget {
  @override
  ConsumerState<_MarkEntry> createState() => _MarkEntryState();
}

class _MarkEntryState extends ConsumerState<_MarkEntry> {
  String? _examId;
  final Map<String, TextEditingController> _marks = {};

  void _initFor(Exam? exam, List<ResultRow> results) {
    _marks.clear();
    for (final s in mock.students) {
      final row = results.where((r) => r.examId == exam?.id && r.studentId == s.id).firstOrNull;
      _marks[s.id] = TextEditingController(text: row?.marks.toString() ?? '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final exams = ref.watch(examsProvider);
    final results = ref.watch(resultsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final exam = _examId == null ? null : exams.where((e) => e.id == _examId).firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _examId,
          hint: const Text('Select an exam to enter marks'),
          items: [
            for (final e in exams)
              DropdownMenuItem(value: e.id, child: Text('${e.moduleCode} — ${e.title}')),
          ],
          onChanged: (v) {
            setState(() => _examId = v);
            _initFor(exams.where((e) => e.id == v).firstOrNull, results);
          },
        ),
        const SizedBox(height: 14),
        if (exam == null)
          const GlassCard(child: EmptyState(message: 'Pick an exam to enter marks.'))
        else
          GlassCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(exam.moduleName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15)),
                      ),
                      Text('Max ${exam.maxMarks}',
                          style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                const Divider(height: 1),
                for (final s in mock.students)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(s.name,
                              style: const TextStyle(fontWeight: FontWeight.w500)),
                        ),
                        SizedBox(
                          width: 80,
                          child: TextField(
                            controller: _marks[s.id],
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(3),
                            ],
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(isDense: true),
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 44,
                          child: Text(
                            _gradeOf(s.id),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: _gradeColor(_gradeOf(s.id), colors),
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: FilledButton.icon(
                    onPressed: () {
                      ref
                          .read(resultsProvider.notifier)
                          .save(exam.id, {
                            for (final s in mock.students)
                              s.id: int.tryParse(_marks[s.id]?.text ?? '') ?? 0,
                          });
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                            content: Text('Marks saved for ${exam.moduleCode}.')),
                      );
                    },
                    icon: const Icon(Icons.save_outlined, size: 18),
                    label: const Text('Save marks'),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  int _markOf(String studentId) => int.tryParse(_marks[studentId]?.text ?? '') ?? 0;

  String _gradeOf(String studentId) =>
      gradeFor(percentage(_markOf(studentId), _max ?? 0));

  int? get _max => _examId == null
      ? null
      : ref
          .read(examsProvider)
          .where((e) => e.id == _examId)
          .firstOrNull
          ?.maxMarks;

  Color _gradeColor(String grade, AppColors colors) {
    if (grade.startsWith('A')) return colors.success;
    if (grade.startsWith('B')) return colors.chart2;
    return colors.warning;
  }
}

class _AllResults extends ConsumerStatefulWidget {
  const _AllResults({required this.role});

  final Role role;

  @override
  ConsumerState<_AllResults> createState() => _AllResultsState();
}

class _AllResultsState extends ConsumerState<_AllResults> {
  String? _studentId;

  @override
  Widget build(BuildContext context) {
    final exams = ref.watch(examsProvider);
    final results = ref.watch(resultsProvider);
    final me = mock.demoUsers[Role.student]!;
    final student = _studentId == null
        ? me
        : mock.students.where((s) => s.id == _studentId).firstOrNull ?? me;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.role != Role.student) ...[
          DropdownButtonFormField<String>(
            initialValue: _studentId,
            hint: const Text('Select a student'),
            items: [
              for (final s in mock.students)
                DropdownMenuItem(value: s.id, child: Text('${s.name} (${s.id})')),
            ],
            onChanged: (v) => setState(() => _studentId = v),
          ),
          const SizedBox(height: 14),
        ],
        ReportCardView(exams: exams, results: results, student: student),
      ],
    );
  }
}

class ReportCardView extends StatelessWidget {
  const ReportCardView({
    super.key,
    required this.exams,
    required this.results,
    required this.student,
  });

  final List<Exam> exams;
  final List<ResultRow> results;
  final UserProfile student;

  List<ReportCardEntry> get _entries => [
        for (final e in exams)
          ReportCardEntry(
            moduleName: e.moduleName,
            moduleCode: e.moduleCode,
            maxMarks: e.maxMarks,
            marks: results
                    .where((r) => r.examId == e.id && r.studentId == student.id)
                    .firstOrNull
                    ?.marks ??
                0,
          ),
      ];

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final entries = _entries;
    final total = entries.fold<int>(0, (a, e) => a + e.marks);
    final max = entries.fold<int>(0, (a, e) => a + e.maxMarks);
    final pct = percentage(total, max);
    final grade = gradeFor(pct);
    final data = ReportCardData(
      studentName: student.name,
      rollNo: student.rollNo ?? student.id,
      department: student.department,
      semester: student.semester ?? 'Semester 5',
      entries: entries,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CardGrid(children: [
          StatCard(
              label: 'Total marks',
              value: '$total / $max',
              tone: colors.chart1,
              icon: Icons.scoreboard_outlined),
          StatCard(
              label: 'Overall',
              value: '$pct%',
              hint: grade,
              tone: colors.chart2,
              icon: Icons.percent_rounded),
          StatCard(
              label: 'Grade',
              value: grade,
              tone: colors.chart3,
              icon: Icons.military_tech_outlined),
        ]),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Expanded(
                      child: Text('${student.name} — ${student.rollNo ?? student.id}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                    TextButton.icon(
                      onPressed: () => exportReportCard(data),
                      icon: const Icon(Icons.download_rounded, size: 18),
                      label: const Text('Download'),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              for (final e in entries)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(e.moduleName,
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(e.moduleCode,
                                style: TextStyle(
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    color: scheme.onSurfaceVariant)),
                          ],
                        ),
                      ),
                      Text('${e.marks} / ${e.maxMarks}',
                          style: const TextStyle(
                              fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                      const SizedBox(width: 12),
                      Container(
                        width: 36,
                        alignment: Alignment.center,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        decoration: BoxDecoration(
                          color: (percentage(e.marks, e.maxMarks) >= 60
                                  ? colors.success
                                  : colors.chart4)
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          gradeFor(percentage(e.marks, e.maxMarks)),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: percentage(e.marks, e.maxMarks) >= 60
                                ? colors.success
                                : colors.chart4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    Text('$total / $max  ($pct%)',
                        style:
                            const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        _GradeTrend(entries: entries, colors: colors),
      ],
    );
  }
}

class _GradeTrend extends StatelessWidget {
  const _GradeTrend({required this.entries, required this.colors});

  final List<ReportCardEntry> entries;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Grade trend',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 14),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final e in entries)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text(
                            '${percentage(e.marks, e.maxMarks)}',
                            style: TextStyle(
                                fontSize: 10,
                                fontFamily: 'monospace',
                                color: scheme.onSurfaceVariant),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            height: 72 *
                                (percentage(e.marks, e.maxMarks) / 100),
                            decoration: BoxDecoration(
                              color: percentage(e.marks, e.maxMarks) >= 60
                                  ? colors.chart2
                                  : colors.chart4,
                              borderRadius:
                                  const BorderRadius.vertical(top: Radius.circular(6)),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(e.moduleCode,
                              style: TextStyle(
                                  fontSize: 9,
                                  fontFamily: 'monospace',
                                  color: scheme.onSurfaceVariant)),
                        ],
                      ),
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

class _ManageExams extends ConsumerStatefulWidget {
  const _ManageExams();

  @override
  ConsumerState<_ManageExams> createState() => _ManageExamsState();
}

class _ManageExamsState extends ConsumerState<_ManageExams> {
  final _formKey = GlobalKey<FormState>();
  String? _moduleCode;
  final _date = TextEditingController();
  final _room = TextEditingController();
  final _start = TextEditingController(text: '09:00');
  final _end = TextEditingController(text: '11:00');
  String? _type;
  final _maxMarks = TextEditingController(text: '50');

  @override
  void dispose() {
    _date.dispose();
    _room.dispose();
    _start.dispose();
    _end.dispose();
    _maxMarks.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final module = mock.schedule.firstWhere((s) => s.code == _moduleCode);
    final exam = Exam(
      id: 'E${DateTime.now().millisecondsSinceEpoch}',
      title: switch (_type) {
        'midterm' => 'Mid-term Examination',
        'final' => 'Final Examination',
        _ => 'Practical Examination',
      },
      moduleCode: module.code,
      moduleName: module.module,
      type: switch (_type) {
        'midterm' => ExamType.midterm,
        'final' => ExamType.finalTerm,
        _ => ExamType.practical,
      },
      date: _date.text.trim(),
      start: _start.text,
      end: _end.text,
      room: _room.text.trim(),
      maxMarks: int.tryParse(_maxMarks.text) ?? 50,
    );
    ref.read(examsProvider.notifier).addExam(exam);
    _date.clear();
    _room.clear();
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Exam scheduled.')));
  }

  @override
  Widget build(BuildContext context) {
    final exams = ref.watch(examsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GlassCard(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Schedule a new exam',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _moduleCode,
                  hint: const Text('Module'),
                  items: mock.schedule
                      .map((s) => DropdownMenuItem(
                          value: s.code, child: Text('${s.code} — ${s.module}')))
                      .toSet()
                      .toList(),
                  onChanged: (v) => setState(() => _moduleCode = v),
                  validator: (v) => v == null ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _type,
                  hint: const Text('Exam type'),
                  items: const [
                    DropdownMenuItem(value: 'midterm', child: Text('Mid-term')),
                    DropdownMenuItem(value: 'final', child: Text('Final')),
                    DropdownMenuItem(value: 'practical', child: Text('Practical')),
                  ],
                  onChanged: (v) => setState(() => _type = v),
                  validator: (v) => v == null ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _date,
                        decoration: const InputDecoration(
                            labelText: 'Date (e.g. 10 Mar 2026)'),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _room,
                        decoration: const InputDecoration(labelText: 'Room'),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: TextFormField(controller: _start, decoration: const InputDecoration(labelText: 'Start (HH:MM)')))],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _end,
                        decoration: const InputDecoration(labelText: 'End (HH:MM)'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _maxMarks,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: const InputDecoration(labelText: 'Max marks'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: _submit,
                  child: const Text('Schedule exam'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        for (final e in exams)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${e.moduleCode} — ${e.title}',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(
                          '${e.date} · ${e.start}–${e.end} · ${e.room}',
                          style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () {
                      ref.read(examsProvider.notifier).deleteExam(e.id);
                    },
                    icon: Icon(Icons.delete_outline_rounded,
                        size: 20, color: colors.chart4),
                    tooltip: 'Delete',
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
