class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    this.lastMessage,
    this.lastSenderId,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.participants = const [],
  });

  final String id;
  final String type;
  final String title;
  final String createdAt;
  final String updatedAt;
  final String? lastMessage;
  final String? lastSenderId;
  final String? lastMessageAt;
  final int unreadCount;
  final List<Participant> participants;

  Conversation copyWith({
    String? lastMessage,
    String? lastSenderId,
    String? lastMessageAt,
    int? unreadCount,
  }) {
    return Conversation(
      id: id,
      type: type,
      title: title,
      createdAt: createdAt,
      updatedAt: updatedAt,
      lastMessage: lastMessage ?? this.lastMessage,
      lastSenderId: lastSenderId ?? this.lastSenderId,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      participants: participants,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'title': title,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        'lastMessage': lastMessage,
        'lastSenderId': lastSenderId,
        'lastMessageAt': lastMessageAt,
        'unreadCount': unreadCount,
        'participants': participants.map((p) => p.toJson()).toList(),
      };

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        id: json['id'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        lastMessage: json['lastMessage'] as String?,
        lastSenderId: json['lastSenderId'] as String?,
        lastMessageAt: json['lastMessageAt'] as String?,
        unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
        participants: (json['participants'] as List<dynamic>?)
                ?.map((p) => Participant.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class Participant {
  const Participant({
    required this.id,
    required this.name,
    required this.avatarInitials,
    required this.role,
  });

  final String id;
  final String name;
  final String avatarInitials;
  final String role;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'avatarInitials': avatarInitials,
        'role': role,
      };

  factory Participant.fromJson(Map<String, dynamic> json) => Participant(
        id: json['id'] as String,
        name: json['name'] as String,
        avatarInitials: json['avatarInitials'] as String,
        role: json['role'] as String,
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.senderInitials,
    required this.content,
    required this.type,
    required this.createdAt,
  });

  final String id;
  final String senderId;
  final String senderName;
  final String senderInitials;
  final String content;
  final String type;
  final String createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'senderId': senderId,
        'senderName': senderName,
        'senderInitials': senderInitials,
        'content': content,
        'type': type,
        'createdAt': createdAt,
      };

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        senderId: json['senderId'] as String,
        senderName: json['senderName'] as String,
        senderInitials: json['senderInitials'] as String,
        content: json['content'] as String,
        type: json['type'] as String,
        createdAt: json['createdAt'] as String,
      );
}
