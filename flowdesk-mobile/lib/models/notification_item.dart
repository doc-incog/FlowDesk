enum NotificationCategory { academic, event, alert, system }

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.time,
    required this.category,
    required this.unread,
  });

  final String id;
  final String title;
  final String body;
  final String time;
  final NotificationCategory category;
  final bool unread;

  NotificationItem copyWith({bool? unread}) {
    return NotificationItem(
      id: id,
      title: title,
      body: body,
      time: time,
      category: category,
      unread: unread ?? this.unread,
    );
  }
}
