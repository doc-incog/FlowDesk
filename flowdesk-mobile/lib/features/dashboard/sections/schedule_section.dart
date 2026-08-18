import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/tabs.dart';
import '../../../core/utils/logic.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/role.dart';
import '../../../models/schedule_slot.dart';
import '../../../providers/schedule_controller.dart';
import 'widgets.dart';

enum _ScheduleTab { weekly, conflicts, add }

class ScheduleSection extends ConsumerStatefulWidget {
  const ScheduleSection({super.key, required this.role});

  final Role role;

  @override
  ConsumerState<ScheduleSection> createState() => _ScheduleSectionState();
}

class _ScheduleSectionState extends ConsumerState<ScheduleSection> {
  _ScheduleTab _tab = _ScheduleTab.weekly;
  String _day = 'Mon';

  // add-slot form
  final _formKey = GlobalKey<FormState>();
  final _start = TextEditingController(text: '10:00');
  final _end = TextEditingController(text: '11:30');
  final _room = TextEditingController();
  String? _moduleCode;
  String? _faculty;
  String? _warning;

  @override
  void dispose() {
    _start.dispose();
    _end.dispose();
    _room.dispose();
    super.dispose();
  }

  bool get _admin => widget.role == Role.admin;

  void _submitAdd(List<ScheduleSlot> slots) {
    final module = mock.schedule.firstWhere((s) => s.code == _moduleCode,
        orElse: () => mock.schedule.first);
    final draft = ScheduleSlot(
      id: 's${DateTime.now().millisecondsSinceEpoch}',
      day: _day,
      start: _start.text,
      end: _end.text,
      module: module.module,
      code: module.code,
      room: _room.text.trim(),
      staff: _faculty ?? '—',
    );
    final conflicts = detectConflicts(slots, draft);
    if (conflicts.isNotEmpty) {
      setState(() {
        _warning = conflicts.map((c) => c.module).join(', ');
      });
      return;
    }
    setState(() => _warning = null);
    ref.read(scheduleProvider.notifier).addSlot(draft);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Slot added to the weekly routine.')),
    );
    _room.clear();
    _start.text = '10:00';
    _end.text = '11:30';
  }

  @override
  Widget build(BuildContext context) {
    final slots = ref.watch(scheduleProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    final tabs = [
      _ScheduleTab.weekly,
      if (widget.role != Role.student) _ScheduleTab.conflicts,
      if (_admin) _ScheduleTab.add,
    ];
    String tabLabel(_ScheduleTab t) => switch (t) {
          _ScheduleTab.weekly => 'Weekly routine',
          _ScheduleTab.conflicts => 'Conflicts',
          _ScheduleTab.add => 'Add slot',
        };

    final daySlots = slots.where((s) => s.day == _day).toList();
    final isWide = !ResponsiveLayout.isCompact(context);

    return SectionScaffold(
      title: 'Schedule',
      description: 'Your weekly academic routine across modules.',
      children: [
        SectionTabs(
          tabs: tabs,
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: tabLabel,
        ),
        if (_tab == _ScheduleTab.weekly) ...[
          if (isWide)
            _WeeklyGrid(slots: slots, colors: colors, scheme: scheme)
          else ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final d in mock.scheduleDays)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: InkWell(
                        onTap: () => setState(() => _day = d),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: _day == d
                                ? colors.chart1
                                : scheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            d,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: _day == d ? Colors.white : scheme.onSurface,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (daySlots.isEmpty)
              const GlassCard(child: EmptyState(message: 'No classes scheduled for this day.'))
            else
              for (final s in daySlots)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GlassCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 4,
                          height: 48,
                          decoration: BoxDecoration(
                            color: colors.chart1,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s.module,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600, fontSize: 15)),
                              const SizedBox(height: 4),
                              Text(
                                '${s.start} – ${s.end}',
                                style: TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 13,
                                    color: colors.chart1,
                                    fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text('${s.room} · ${s.staff}',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: scheme.onSurfaceVariant)),
                            ],
                          ),
                        ),
                        Text(s.code,
                            style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ),
          ],
        ],
        if (_tab == _ScheduleTab.conflicts) ...[
          GlassCard(
            color: colors.warning.withValues(alpha: 0.08),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: colors.warning),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Slots sharing the same room or faculty at overlapping times are flagged here.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          for (final (i, a) in slots.indexed)
            for (final b in slots.skip(i + 1))
              if (_overlaps(a, b))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GlassCard(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, size: 20, color: colors.chart4),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${a.module} vs ${b.module}',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(
                                '${a.day} ${a.start}–${a.end}  ·  ${b.day} ${b.start}–${b.end}',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: scheme.onSurfaceVariant),
                              ),
                              Text(
                                a.room == b.room
                                    ? 'Shared room ${a.room}'
                                    : 'Shared faculty ${a.staff}',
                                style: TextStyle(
                                    fontSize: 12, color: colors.warning),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ],
        if (_tab == _ScheduleTab.add) ...[
          GlassCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Add a slot',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 14),
                  InputDecorator(
                    decoration: const InputDecoration(labelText: 'Day'),
                    child: DropdownButton<String>(
                      value: _day,
                      isExpanded: true,
                      underline: const SizedBox.shrink(),
                      items: mock.scheduleDays
                          .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                          .toList(),
                      onChanged: (v) => setState(() => _day = v ?? 'Mon'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _TimeField(controller: _start, label: 'Start (HH:MM)'),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _TimeField(controller: _end, label: 'End (HH:MM)'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _moduleCode,
                    hint: const Text('Select module'),
                    items: mock.schedule
                        .map((s) => DropdownMenuItem(
                            value: s.code, child: Text('${s.code} — ${s.module}')))
                        .toSet()
                        .toList(),
                    onChanged: (v) => setState(() => _moduleCode = v),
                    validator: (v) => v == null ? 'Module is required' : null,
                    decoration: const InputDecoration(labelText: 'Module'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _room,
                    decoration: const InputDecoration(labelText: 'Room'),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Room is required' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _faculty,
                    hint: const Text('Select faculty'),
                    items: mock.staff
                        .map((s) => DropdownMenuItem(
                            value: s.name, child: Text(s.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _faculty = v),
                    decoration: const InputDecoration(labelText: 'Faculty'),
                  ),
                  if (_warning != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: colors.chart4.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Conflict with: $_warning. Pick a different time, room or faculty.',
                        style: TextStyle(
                            fontSize: 13, color: colors.chart4),
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: () {
                      if (_formKey.currentState!.validate()) {
                        _submitAdd(slots);
                      }
                    },
                    child: const Text('Add slot'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  bool _overlaps(ScheduleSlot a, ScheduleSlot b) => detectConflicts([a], b).isNotEmpty;
}

/// Weekly grid view for tablet/wide layouts.
class _WeeklyGrid extends StatelessWidget {
  const _WeeklyGrid({required this.slots, required this.colors, required this.scheme});

  final List<ScheduleSlot> slots;
  final AppColors colors;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          for (final day in mock.scheduleDays) ...[
            if (day != mock.scheduleDays.first)
              Divider(height: 1, color: scheme.outlineVariant),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 48,
                    child: Text(day,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Builder(
                      builder: (_) {
                        final daySlots = slots.where((s) => s.day == day).toList();
                        if (daySlots.isEmpty) {
                          return Text('No classes',
                              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant));
                        }
                        return Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final s in daySlots)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: colors.chart1.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(s.module,
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    Text('${s.start}–${s.end} · ${s.room}',
                                        style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                                  ],
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TimeField extends StatelessWidget {
  const _TimeField({required this.controller, required this.label});

  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.datetime,
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9:]')),
        LengthLimitingTextInputFormatter(5),
      ],
      decoration: InputDecoration(labelText: label),
      validator: (v) {
        if (v == null || !RegExp(r'^([01]?\d|2[0-3]):[0-5]\d$').hasMatch(v)) {
          return 'Invalid time';
        }
        return null;
      },
    );
  }
}
