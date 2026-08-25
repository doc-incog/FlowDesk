import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/mock_data.dart' as mock;
import '../models/notification_item.dart';

class NotificationsController extends Notifier<List<NotificationItem>> {
  @override
  List<NotificationItem> build() => List.of(mock.notifications);

  void markRead(String id) {
    state = state.map((n) => n.id == id ? n.copyWith(unread: false) : n).toList();
  }

  void markAllRead() {
    state = state.map((n) => n.copyWith(unread: false)).toList();
  }

  void send({
    required String title,
    required String body,
    required NotificationCategory category,
  }) {
    final n = NotificationItem(
      id: 'n-${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      body: body,
      time: 'Just now',
      category: category,
      unread: true,
    );
    state = [n, ...state];
  }
}

final notificationsProvider =
    NotifierProvider<NotificationsController, List<NotificationItem>>(NotificationsController.new);
