import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/section_heading.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/check_in.dart';
import '../../../models/role.dart';
import '../../../providers/checkin_controller.dart';
import '../../checkin/biometric_scanner.dart';
import 'widgets.dart';

class CheckInSection extends ConsumerWidget {
  const CheckInSection({super.key, required this.role, required this.userName});

  final Role role;
  final String userName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkInProvider);
    final records = state.records;
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    // Filter records based on role
    final filteredRecords = switch (role) {
      Role.student => records.where((r) => r.name == userName).toList(),
      Role.staff => records
          .where((r) => r.role == Role.student && _isMenteeOf(r.name))
          .toList(),
      Role.admin => records,
    };

    final present = filteredRecords.where((r) => r.status == CheckInStatus.onTime).length;
    final late = filteredRecords.where((r) => r.status == CheckInStatus.late).length;
    final absent = filteredRecords.where((r) => r.status == CheckInStatus.absent).length;
    final total = filteredRecords.length;
    final percentage = total > 0 ? ((present + late) / total * 100).round() : 0;

    return SectionScaffold(
      title: role == Role.student
          ? 'Check-in'
          : role == Role.staff
              ? 'Mentee attendance'
              : 'Attendance overview',
      description: role == Role.student
          ? 'Record your presence for today using the biometric scanner.'
          : role == Role.staff
              ? 'View attendance records for your mentees.'
              : 'View and filter attendance records for all users.',
      children: [
        // Biometric scanner — student only
        if (role == Role.student) ...[
          CardGrid(children: [
            GlassCard(
              child: Column(
                children: [
                  BiometricScanner(
                    onVerified: (_) => ref
                        .read(checkInProvider.notifier)
                        .checkIn(userName, role, CheckInMethod.biometric),
                  ),
                  const SizedBox(height: 14),
                  if (state.checkedIn)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.verified_rounded, size: 16, color: colors.success),
                        const SizedBox(width: 6),
                        Text('Checked in for today',
                            style: TextStyle(color: colors.success, fontWeight: FontWeight.w600)),
                      ],
                    )
                  else
                    TextButton(
                      onPressed: () => ref
                          .read(checkInProvider.notifier)
                          .checkIn(userName, role, CheckInMethod.manual),
                      child: const Text('Mark manually'),
                    ),
                ],
              ),
            ),
          ]),
          // Personal stats
          CardGrid(children: [
            StatCard(
              label: 'Present',
              value: '$present',
              hint: 'On-time check-ins',
              tone: colors.success,
            ),
            StatCard(
              label: 'Late',
              value: '$late',
              hint: 'After 09:00',
              tone: colors.warning,
            ),
            StatCard(
              label: 'Absent',
              value: '$absent',
              hint: 'Days missed',
              tone: colors.chart4,
            ),
            StatCard(
              label: 'Attendance',
              value: '$percentage%',
              hint: 'This semester',
              tone: colors.chart1,
            ),
          ]),
        ],

        // Stats for staff/admin
        if (role != Role.student) ...[
          CardGrid(children: [
            StatCard(
              label: 'Present',
              value: '$present',
              hint: 'On-time',
              tone: colors.success,
            ),
            StatCard(
              label: 'Late',
              value: '$late',
              hint: 'After 09:00',
              tone: colors.warning,
            ),
            StatCard(
              label: 'Absent',
              value: '$absent',
              hint: 'Days missed',
              tone: colors.chart4,
            ),
            StatCard(
              label: 'Attendance',
              value: '$percentage%',
              hint: role == Role.staff ? 'Your mentees' : 'All users',
              tone: colors.chart1,
            ),
          ]),
        ],

        // Check-in log
        SectionHeading(
          title: role == Role.student
              ? 'Your check-in record'
              : 'Today\'s check-in log',
          action: role == Role.student && state.checkedIn
              ? TextButton(
                  onPressed: () => ref.read(checkInProvider.notifier).reset(),
                  child: const Text('Reset demo'),
                )
              : null,
        ),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              if (filteredRecords.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('No check-ins for today yet.',
                      style: TextStyle(color: Colors.grey)),
                )
              else
                for (var i = 0; i < filteredRecords.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      backgroundColor: scheme.surfaceContainerHighest,
                      child: Text(
                        _initials(filteredRecords[i].name),
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: scheme.onSurface),
                      ),
                    ),
                    title: Text(filteredRecords[i].name,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(filteredRecords[i].method.label),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(filteredRecords[i].time,
                            style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: scheme.onSurfaceVariant)),
                        const SizedBox(width: 10),
                        _statusPill(filteredRecords[i].status, context),
                      ],
                    ),
                  ),
                ],
            ],
          ),
        ),

        // Attendance History Section
        SectionHeading(
          title: role == Role.student
              ? 'Attendance history'
              : 'Attendance history & search',
          description: role == Role.student
              ? 'Search your past attendance records.'
              : role == Role.staff
                  ? 'Search mentee attendance records.'
                  : 'Search all attendance records.',
        ),
        _AttendanceHistorySection(role: role, userName: userName),
      ],
    );
  }

  bool _isMenteeOf(String studentName) {
    // Dr. Rahul Menon (STF-118) mentors: Aisha Karim, Dev Patel, Liam Wong
    final menteeMap = {
      'Dr. Rahul Menon': ['Aisha Karim', 'Dev Patel', 'Liam Wong'],
      'Dr. Neha Gupta': ['Sara Lin', 'Omar Faruk'],
    };
    return menteeMap[userName]?.contains(studentName) ?? false;
  }

  String _initials(String name) {
    final parts = name.split(' ');
    return parts.length >= 2
        ? '${parts.first[0]}${parts[1][0]}'
        : name.substring(0, 2).toUpperCase();
  }

  Widget _statusPill(CheckInStatus status, BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final (color, label) = switch (status) {
      CheckInStatus.onTime => (colors.success, 'On time'),
      CheckInStatus.late => (colors.warning, 'Late'),
      CheckInStatus.absent => (colors.chart4, 'Absent'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _AttendanceHistorySection extends ConsumerStatefulWidget {
  const _AttendanceHistorySection({required this.role, required this.userName});

  final Role role;
  final String userName;

  @override
  ConsumerState<_AttendanceHistorySection> createState() =>
      _AttendanceHistorySectionState();
}

class _AttendanceHistorySectionState
    extends ConsumerState<_AttendanceHistorySection> {
  DateTime? _fromDate;
  DateTime? _toDate;
  String _roleFilter = 'all';
  bool _searched = false;

  List<CheckInRecord> _historyRecords = [];

  @override
  Widget build(BuildContext context) {
    final allRecords = ref.watch(checkInProvider).records;
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    // Compute history based on filters
    final records = _searched ? _computeHistory(allRecords) : <CheckInRecord>[];
    final present = records.where((r) => r.status == CheckInStatus.onTime).length;
    final late = records.where((r) => r.status == CheckInStatus.late).length;
    final absent = records.where((r) => r.status == CheckInStatus.absent).length;
    final total = records.length;
    final pct = total > 0 ? ((present + late) / total * 100).round() : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _datePicker(
                      context,
                      label: 'From',
                      date: _fromDate,
                      onChanged: (d) => setState(() => _fromDate = d),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _datePicker(
                      context,
                      label: 'To',
                      date: _toDate,
                      onChanged: (d) => setState(() => _toDate = d),
                    ),
                  ),
                ],
              ),
              if (widget.role == Role.admin) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _roleFilter,
                  decoration: const InputDecoration(
                      labelText: 'Role', isDense: true),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All users')),
                    DropdownMenuItem(
                        value: 'student', child: Text('Students only')),
                    DropdownMenuItem(value: 'staff', child: Text('Staff only')),
                  ],
                  onChanged: (v) {
                    if (v != null) setState(() => _roleFilter = v);
                  },
                ),
              ],
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => setState(() => _searched = true),
                icon: const Icon(Icons.search_rounded, size: 18),
                label: const Text('Search'),
              ),
            ],
          ),
        ),
        if (_searched && records.isNotEmpty) ...[
          const SizedBox(height: 12),
          GlassCard(
            color: scheme.surfaceContainerHighest.withValues(alpha: 0.3),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Wrap(
              spacing: 14,
              runSpacing: 4,
              children: [
                Text('$total total',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('$present present',
                    style: TextStyle(
                        color: colors.success, fontWeight: FontWeight.w600)),
                Text('$late late',
                    style: TextStyle(
                        color: colors.warning, fontWeight: FontWeight.w600)),
                Text('$absent absent',
                    style: TextStyle(
                        color: colors.chart4, fontWeight: FontWeight.w600)),
                Text('$pct% attendance',
                    style: TextStyle(
                        color: colors.chart1, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
        const SizedBox(height: 8),
        if (_searched && records.isNotEmpty)
          GlassCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < records.length; i++) ...[
                  if (i > 0)
                    const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      backgroundColor: scheme.surfaceContainerHighest,
                      child: Text(
                        _initials(records[i].name),
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: scheme.onSurface),
                      ),
                    ),
                    title: Text(records[i].name,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      '${records[i].method.label} · ${records[i].time}',
                      style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: scheme.onSurfaceVariant),
                    ),
                    trailing: _statusPill(records[i].status, context),
                  ),
                ],
              ],
            ),
          )
        else if (_searched)
          const GlassCard(
            child: EmptyState(
                message: 'No records found for the selected date range.'),
          ),
      ],
    );
  }

  List<CheckInRecord> _computeHistory(List<CheckInRecord> allRecords) {
    // Use mock data as the base for history (simulated past records)
    final baseRecords = List<CheckInRecord>.from(mock.checkIns);

    return baseRecords.where((r) {
      // Role-based filtering
      if (widget.role == Role.student && r.name != widget.userName) return false;
      if (widget.role == Role.staff) {
        final menteeMap = {
          'Dr. Rahul Menon': ['Aisha Karim', 'Dev Patel', 'Liam Wong'],
          'Dr. Neha Gupta': ['Sara Lin', 'Omar Faruk'],
        };
        if (!(menteeMap[widget.userName]?.contains(r.name) ?? false)) return false;
      }
      if (widget.role == Role.admin && _roleFilter != 'all') {
        if (_roleFilter == 'student' && r.role != Role.student) return false;
        if (_roleFilter == 'staff' && r.role != Role.staff) return false;
      }
      return true;
    }).toList();
  }

  Widget _datePicker(
    BuildContext context, {
    required String label,
    required DateTime? date,
    required ValueChanged<DateTime> onChanged,
  }) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date ?? DateTime.now(),
          firstDate: DateTime(2024),
          lastDate: DateTime.now(),
        );
        if (picked != null) onChanged(picked);
      },
      borderRadius: BorderRadius.circular(10),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
        child: Text(
          date != null
              ? '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}'
              : 'Select date',
          style: TextStyle(
            fontFamily: 'monospace',
            fontSize: 13,
            color: date != null ? scheme.onSurface : scheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.split(' ');
    return parts.length >= 2
        ? '${parts.first[0]}${parts[1][0]}'
        : name.substring(0, 2).toUpperCase();
  }

  Widget _statusPill(CheckInStatus status, BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final (color, label) = switch (status) {
      CheckInStatus.onTime => (colors.success, 'On time'),
      CheckInStatus.late => (colors.warning, 'Late'),
      CheckInStatus.absent => (colors.chart4, 'Absent'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
