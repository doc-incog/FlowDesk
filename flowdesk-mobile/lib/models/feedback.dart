enum FeedbackTargetType { teacher, event }

class FeedbackTarget {
  const FeedbackTarget({
    required this.id,
    required this.type,
    required this.name,
    required this.subtitle,
  });

  final String id;
  final FeedbackTargetType type;
  final String name;
  final String subtitle;
}

class FeedbackEntry {
  const FeedbackEntry({
    required this.id,
    required this.targetId,
    required this.rating,
    required this.comment,
    required this.byName,
    required this.createdAt,
  });

  final String id;
  final String targetId;
  final int rating;
  final String comment;
  final String byName;
  final String createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'targetId': targetId,
        'rating': rating,
        'comment': comment,
        'byName': byName,
        'createdAt': createdAt,
      };

  factory FeedbackEntry.fromJson(Map<String, dynamic> json) => FeedbackEntry(
        id: json['id'] as String,
        targetId: json['targetId'] as String,
        rating: (json['rating'] as num).toInt(),
        comment: json['comment'] as String,
        byName: json['byName'] as String,
        createdAt: json['createdAt'] as String,
      );
}
