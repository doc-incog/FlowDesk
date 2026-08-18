import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass.dart';
import '../../../models/notification_item.dart';
import '../../../models/role.dart';
import '../../../providers/notifications_controller.dart';
import 'widgets.dart';

class NotificationsSection extends ConsumerStatefulWidget {
  const NotificationsSection({super.key, required this.role});

  final Role role;

  @override
  ConsumerState<NotificationsSection> createState() => _NotificationsSectionState();
}

class _NotificationsSectionState extends ConsumerState<NotificationsSection> {
  NotificationCategory? _filter;
  bool _composing = false;
  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  NotificationCategory _composeCategory = NotificationCategory.system;
  String _composeTarget = 'all';
  bool _sending = false;
  String? _sendError;
  bool _sendSuccess = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(notificationsProvider);
    final filtered = _filter == null
        ? notifications
        : notifications.where((n) => n.category == _filter).toList();
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    return SectionScaffold(
      title: 'Notifications',
      description: 'Announcements and alerts from across the campus.',
      action: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.role == Role.admin)
            TextButton.icon(
              onPressed: () => setState(() => _composing = !_composing),
              icon: const Icon(Icons.send_rounded, size: 16),
              label: const Text('Send'),
            ),
          TextButton.icon(
            onPressed: () => ref.read(notificationsProvider.notifier).markAllRead(),
            icon: const Icon(Icons.done_all_rounded, size: 16),
            label: const Text('Mark all read'),
          ),
        ],
      ),
      children: [
        // Admin compose form
        if (widget.role == Role.admin && _composing)
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Compose notification',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 4),
                Text('Send to students, staff, or everyone.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant)),
                const SizedBox(height: 14),
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    hintText: 'e.g. Campus holiday announcement',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bodyCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Message',
                    hintText: 'Notification details…',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<NotificationCategory>(
                        value: _composeCategory,
                        decoration: const InputDecoration(
                            labelText: 'Category', isDense: true),
                        items: const [
                          DropdownMenuItem(
                              value: NotificationCategory.academic,
                              child: Text('Academic')),
                          DropdownMenuItem(
                              value: NotificationCategory.event,
                              child: Text('Event')),
                          DropdownMenuItem(
                              value: NotificationCategory.alert,
                              child: Text('Alert')),
                          DropdownMenuItem(
                              value: NotificationCategory.system,
                              child: Text('System')),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _composeCategory = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _composeTarget,
                        decoration: const InputDecoration(
                            labelText: 'Send to', isDense: true),
                        items: const [
                          DropdownMenuItem(
                              value: 'all', child: Text('Everyone')),
                          DropdownMenuItem(
                              value: 'students', child: Text('Students')),
                          DropdownMenuItem(
                              value: 'staff', child: Text('Staff')),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _composeTarget = v);
                        },
                      ),
                    ),
                  ],
                ),
                if (_sendError != null) ...[
                  const SizedBox(height: 8),
                  Text(_sendError!,
                      style: TextStyle(color: scheme.error, fontSize: 12)),
                ],
                if (_sendSuccess) ...[
                  const SizedBox(height: 8),
                  Text('Notification sent!',
                      style: TextStyle(
                          color: colors.success,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _titleCtrl.text.trim().isEmpty || _sending
                      ? null
                      : _send,
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: Text(_sending ? 'Sending…' : 'Send notification'),
                ),
              ],
            ),
          ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _filterChip(context, null, 'All'),
              for (final c in NotificationCategory.values)
                _filterChip(context, c, _categoryLabel(c)),
            ],
          ),
        ),
        if (filtered.isEmpty)
          const GlassCard(child: EmptyState(message: 'No notifications in this category.'))
        else
          for (final n in filtered)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                padding: const EdgeInsets.all(14),
                color: n.unread
                    ? colors.chart1.withValues(alpha: 0.06)
                    : null,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: _categoryColor(n.category, colors)
                            .withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(_categoryIcon(n.category),
                          size: 18, color: _categoryColor(n.category, colors)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(n.title,
                                    style: TextStyle(
                                        fontWeight: n.unread
                                            ? FontWeight.w700
                                            : FontWeight.w600)),
                              ),
                              Text(n.time,
                                  style: TextStyle(
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                      color: scheme.onSurfaceVariant)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(n.body,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: scheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                    if (n.unread)
                      IconButton(
                        onPressed: () =>
                            ref.read(notificationsProvider.notifier).markRead(n.id),
                        icon: const Icon(Icons.done_rounded, size: 18),
                        tooltip: 'Mark as read',
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  Future<void> _send() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) return;
    setState(() {
      _sending = true;
      _sendError = null;
      _sendSuccess = false;
    });

    // Simulate sending (mock — in production this would call the API)
    await Future.delayed(const Duration(milliseconds: 600));

    // Add the notification to the local list
    ref.read(notificationsProvider.notifier).addNotification(
          NotificationItem(
            id: 'n-${DateTime.now().millisecondsSinceEpoch}',
            title: title,
            body: _bodyCtrl.text.trim(),
            time: 'Just now',
            category: _composeCategory,
            unread: true,
          ),
        );

    _titleCtrl.clear();
    _bodyCtrl.clear();
    setState(() {
      _sending = false;
      _sendSuccess = true;
    });

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _sendSuccess = false);
    });
  }

  Widget _filterChip(BuildContext context, NotificationCategory? c, String label) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final active = _filter == c;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: () => setState(() => _filter = c),
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: active
                ? colors.chart1
                : Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: active ? Colors.white : Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ),
      ),
    );
  }

  String _categoryLabel(NotificationCategory c) => switch (c) {
        NotificationCategory.academic => 'Academic',
        NotificationCategory.event => 'Event',
        NotificationCategory.alert => 'Alert',
        NotificationCategory.system => 'System',
      };

  IconData _categoryIcon(NotificationCategory c) => switch (c) {
        NotificationCategory.academic => Icons.menu_book_outlined,
        NotificationCategory.event => Icons.calendar_month_outlined,
        NotificationCategory.alert => Icons.warning_amber_rounded,
        NotificationCategory.system => Icons.settings_outlined,
      };

  Color _categoryColor(NotificationCategory c, AppColors colors) => switch (c) {
        NotificationCategory.academic => colors.chart1,
        NotificationCategory.event => colors.chart2,
        NotificationCategory.alert => colors.warning,
        NotificationCategory.system => colors.chart5,
      };
}
