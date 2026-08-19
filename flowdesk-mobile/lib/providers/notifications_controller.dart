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
}

final notificationsProvider =
    NotifierProvider<NotificationsController, List<NotificationItem>>(NotificationsController.new);
