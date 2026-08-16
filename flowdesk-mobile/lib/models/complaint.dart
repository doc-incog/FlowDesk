import 'role.dart';

enum ComplaintCategory { academics, hostel, library, it, transport, other }

enum ComplaintStatus { open, inProgress, resolved }

class ComplaintComment {
  const ComplaintComment({
    required this.id,
    required this.author,
    required this.text,
    required this.at,
  });

  final String id;
  final String author;
  final String text;
  final String at;

  Map<String, dynamic> toJson() => {'id': id, 'author': author, 'text': text, 'at': at};

  factory ComplaintComment.fromJson(Map<String, dynamic> json) => ComplaintComment(
        id: json['id'] as String,
        author: json['author'] as String,
        text: json['text'] as String,
        at: json['at'] as String,
      );
}

class Complaint {
  const Complaint({
    required this.id,
    required this.category,
    required this.subject,
    required this.description,
    required this.status,
    required this.createdAt,
    required this.raisedByName,
    required this.raisedByRole,
    required this.comments,
  });

  final String id;
  final ComplaintCategory category;
  final String subject;
  final String description;
  final ComplaintStatus status;
  final String createdAt;
  final String raisedByName;
  final Role raisedByRole;
  final List<ComplaintComment> comments;

  Map<String, dynamic> toJson() => {
        'id': id,
        'category': category.name,
        'subject': subject,
        'description': description,
        'status': status.name,
        'createdAt': createdAt,
        'raisedByName': raisedByName,
        'raisedByRole': raisedByRole.key,
        'comments': comments.map((c) => c.toJson()).toList(),
      };

  factory Complaint.fromJson(Map<String, dynamic> json) => Complaint(
        id: json['id'] as String,
        category: ComplaintCategory.values.firstWhere(
            (c) => c.name == json['category'],
            orElse: () => ComplaintCategory.other),
        subject: json['subject'] as String,
        description: json['description'] as String,
        status: ComplaintStatus.values.firstWhere(
            (s) => s.name == json['status'],
            orElse: () => ComplaintStatus.open),
        createdAt: json['createdAt'] as String,
        raisedByName: json['raisedByName'] as String,
        raisedByRole: Role.fromKey(json['raisedByRole'] as String? ?? 'student'),
        comments: (json['comments'] as List<dynamic>? ?? const [])
            .map((e) => ComplaintComment.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Complaint copyWith({
    ComplaintStatus? status,
    List<ComplaintComment>? comments,
  }) =>
      Complaint(
        id: id,
        category: category,
        subject: subject,
        description: description,
        status: status ?? this.status,
        createdAt: createdAt,
        raisedByName: raisedByName,
        raisedByRole: raisedByRole,
        comments: comments ?? this.comments,
      );
}

extension ComplaintCategoryX on ComplaintCategory {
  String get label => switch (this) {
        ComplaintCategory.academics => 'Academics',
        ComplaintCategory.hostel => 'Hostel',
        ComplaintCategory.library => 'Library',
        ComplaintCategory.it => 'IT',
        ComplaintCategory.transport => 'Transport',
        ComplaintCategory.other => 'Other',
      };
}

extension ComplaintStatusX on ComplaintStatus {
  String get label => switch (this) {
        ComplaintStatus.open => 'Open',
        ComplaintStatus.inProgress => 'In progress',
        ComplaintStatus.resolved => 'Resolved',
      };
}
