import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/section_heading.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/check_in.dart';
import '../../../models/role.dart';
import '../../../providers/notifications_controller.dart';
import 'widgets.dart';
import '../section.dart';

class OverviewSection extends ConsumerWidget {
  const OverviewSection({super.key, required this.role, required this.onNavigate});

  final Role role;
  final ValueChanged<SectionId> onNavigate;

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = mock.campusStats;
    final unread = ref.watch(notificationsProvider).where((n) => n.unread).length;
    final todaySlots = mock.schedule.where((s) => s.day == 'Mon').toList();
    final notices = ref.watch(notificationsProvider).take(3).toList();
    final colors = Theme.of(context).extension<AppColors>()!;

    final statCards = switch (role) {
      Role.admin => [
          StatCard(label: 'Total students', value: '${stats.totalStudents}', hint: 'Across all programmes', icon: Icons.school_outlined, tone: colors.chart1),
          StatCard(label: 'Total staff', value: '${stats.totalStaff}', hint: 'Faculty & administration', icon: Icons.groups_outlined, tone: colors.chart2),
          StatCard(label: 'Present today', value: '${stats.presentToday}', hint: '${(stats.presentToday / stats.totalStudents * 100).round()}% attendance', icon: Icons.how_to_reg_rounded, tone: colors.chart3),
          StatCard(label: 'Biometric devices', value: '${stats.devicesOnline}/${stats.biometricDevices}', hint: 'Devices online', icon: Icons.fingerprint_rounded, tone: colors.chart5),
        ],
      Role.staff => [
          StatCard(label: 'Mentees', value: '12', hint: 'Under my guidance', icon: Icons.person_outline_rounded, tone: colors.chart1),
          StatCard(label: 'Classes today', value: '${todaySlots.length}', hint: 'Mon routine', icon: Icons.menu_book_outlined, tone: colors.chart2),
          StatCard(label: 'Present today', value: '${stats.presentToday}', hint: 'Campus-wide', icon: Icons.how_to_reg_rounded, tone: colors.chart3),
          StatCard(label: 'Unread notices', value: '$unread', hint: 'Notifications', icon: Icons.notifications_outlined, tone: colors.chart5),
        ],
      Role.student => [
          StatCard(label: 'Attendance', value: '${stats.avgAttendance}%', hint: 'This semester', icon: Icons.percent_rounded, tone: colors.chart2),
          StatCard(label: 'Classes today', value: '${todaySlots.length}', hint: 'Mon routine', icon: Icons.menu_book_outlined, tone: colors.chart1),
          StatCard(label: 'Check-in', value: '—', hint: 'Not checked in yet', icon: Icons.fingerprint_rounded, tone: colors.chart3),
          StatCard(label: 'Unread notices', value: '$unread', hint: 'Notifications', icon: Icons.notifications_outlined, tone: colors.chart5),
        ],
    };

    final quickActions = <(String, IconData, SectionId)>[
      ('Check in', Icons.fingerprint_rounded, SectionId.checkin),
      ('Schedule', Icons.calendar_month_outlined, SectionId.schedule),
      ('Notices', Icons.notifications_outlined, SectionId.notifications),
      if (role == Role.admin)
        ('Directory', Icons.people_outline_rounded, SectionId.staff)
      else
        ('Mentor', Icons.person_outline_rounded, SectionId.mentor),
    ];

    return SectionScaffold(
      title: '$_greeting 👋',
      description: role == Role.admin
          ? 'Overview of the whole campus.'
          : role == Role.staff
              ? 'Here is your day at a glance.'
              : 'Here is your day at a glance.',
      children: [
        CardGrid(children: statCards),
        SectionHeading(
          title: "Today's routine",
          action: TextButton(
            onPressed: () => onNavigate(SectionId.schedule),
            child: const Text('Full schedule'),
          ),
        ),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < todaySlots.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  dense: true,
                  title: Text(todaySlots[i].module,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                      '${todaySlots[i].start} – ${todaySlots[i].end}  ·  ${todaySlots[i].room}  ·  ${todaySlots[i].staff}'),
                  trailing: Text(todaySlots[i].code,
                      style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ),
              ],
            ],
          ),
        ),
        SectionHeading(title: 'Quick actions'),
        CardGrid(
          children: [
            for (final (label, icon, target) in quickActions)
              GlassCard(
                onTap: () => onNavigate(target),
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: colors.chart1.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Icon(icon, size: 18, color: colors.chart1),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text(label,
                            style: const TextStyle(fontWeight: FontWeight.w600))),
                    Icon(Icons.chevron_right_rounded,
                        size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ],
                ),
              ),
          ],
        ),
        SectionHeading(title: 'Latest notices'),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < notices.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  dense: true,
                  leading: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: colors.chart1.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.campaign_outlined, size: 16, color: colors.chart1),
                  ),
                  title: Text(notices[i].title,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(notices[i].body, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: Text(notices[i].time,
                      style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ),
              ],
            ],
          ),
        ),
        if (role == Role.staff) ...[
          SectionHeading(title: 'Recent student check-ins'),
          GlassCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < mock.checkIns.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    dense: true,
                    leading: Avatar(initials: _initials(mock.checkIns[i].name), size: 32),
                    title: Text(mock.checkIns[i].name,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(mock.checkIns[i].time),
                    trailing: _statusPill(mock.checkIns[i].status, context),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
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
