import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../models/notification_item.dart';
import '../../../models/role.dart';
import '../../../providers/auth_controller.dart';
import '../../../providers/notifications_controller.dart';
import 'widgets.dart';

class NotificationsSection extends ConsumerStatefulWidget {
  const NotificationsSection({super.key});

  @override
  ConsumerState<NotificationsSection> createState() => _NotificationsSectionState();
}

class _NotificationsSectionState extends ConsumerState<NotificationsSection> {
  NotificationCategory? _filter;

  void _compose() {
    showAppModal(
      context: context,
      title: 'Send notification',
      child: _ComposeForm(
        onSend: (title, body, category) {
          ref.read(notificationsProvider.notifier).send(
                title: title,
                body: body,
                category: category,
              );
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Notification sent.')),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(notificationsProvider);
    final user = ref.watch(authProvider);
    final isAdmin = user?.role == Role.admin;
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
          TextButton.icon(
            onPressed: () => ref.read(notificationsProvider.notifier).markAllRead(),
            icon: const Icon(Icons.done_all_rounded, size: 16),
            label: const Text('Mark all read'),
          ),
          if (isAdmin) ...[
            const SizedBox(width: 8),
            FilledButton.icon(
              onPressed: _compose,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Compose'),
            ),
          ],
        ],
      ),
      children: [
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

class _ComposeForm extends StatefulWidget {
  const _ComposeForm({required this.onSend});

  final void Function(String title, String body, NotificationCategory category) onSend;

  @override
  State<_ComposeForm> createState() => _ComposeFormState();
}

class _ComposeFormState extends State<_ComposeForm> {
  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  NotificationCategory _category = NotificationCategory.academic;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _titleCtrl,
          decoration: const InputDecoration(labelText: 'Title'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _bodyCtrl,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Message'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<NotificationCategory>(
          initialValue: _category,
          decoration: const InputDecoration(labelText: 'Category'),
          items: NotificationCategory.values
              .map((c) => DropdownMenuItem(
                    value: c,
                    child: Text(c.name[0].toUpperCase() + c.name.substring(1)),
                  ))
              .toList(),
          onChanged: (v) => setState(() => _category = v!),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () {
            if (_titleCtrl.text.trim().isEmpty || _bodyCtrl.text.trim().isEmpty) return;
            widget.onSend(_titleCtrl.text.trim(), _bodyCtrl.text.trim(), _category);
          },
          child: const Text('Send notification'),
        ),
      ],
    );
  }
}
