import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/section_heading.dart';
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

    final present = records.where((r) => r.status != CheckInStatus.absent).length;
    final late = records.where((r) => r.status == CheckInStatus.late).length;

    return SectionScaffold(
      title: 'Check-in',
      description: 'Record your presence for today using the biometric scanner.',
      children: [
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
          Column(
            children: [
              CardGrid(children: [
                StatCard(
                  label: 'Present',
                  value: '$present',
                  hint: 'Recorded today',
                  tone: colors.success,
                ),
                StatCard(
                  label: 'Late',
                  value: '$late',
                  hint: 'After 09:00',
                  tone: colors.warning,
                ),
              ]),
              const SizedBox(height: 12),
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Devices online',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(Icons.sensors_rounded,
                            size: 20, color: colors.success),
                        const SizedBox(width: 8),
                        const Text('7 / 8 online'),
                        const Spacer(),
                        Text('Last sync 08:55 AM',
                            style: TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: scheme.onSurfaceVariant)),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      children: [
                        Icon(Icons.scanner_outlined,
                            size: 20, color: colors.chart1),
                        const SizedBox(width: 8),
                        const Expanded(
                            child: Text('Science Block — Scanner #3',
                                style: TextStyle(fontWeight: FontWeight.w600))),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ]),
        SectionHeading(
          title: "Today's check-in log",
          action: TextButton(
            onPressed: state.checkedIn
                ? () => ref.read(checkInProvider.notifier).reset()
                : null,
            child: const Text('Reset demo'),
          ),
        ),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < records.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  dense: true,
                  leading: Avatar(
                      initials: _initials(records[i].name), size: 34),
                  title: Text(records[i].name,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(records[i].method.label),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(records[i].time,
                          style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: scheme.onSurfaceVariant)),
                      const SizedBox(width: 10),
                      _statusPill(records[i].status, context),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
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
