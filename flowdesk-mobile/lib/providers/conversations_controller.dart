import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/conversations_mock_data.dart';
import '../data/mock_data.dart' as mock;
import '../models/conversation.dart';
import '../models/user.dart';

class ConversationsState {
  const ConversationsState({
    this.conversations = const [],
    this.activeConversationId,
    this.messages = const [],
    this.loading = false,
    this.error,
  });

  final List<Conversation> conversations;
  final String? activeConversationId;
  final List<ChatMessage> messages;
  final bool loading;
  final String? error;

  Conversation? get activeConversation =>
      activeConversationId != null
          ? conversations.where((c) => c.id == activeConversationId).firstOrNull
          : null;

  ConversationsState copyWith({
    List<Conversation>? conversations,
    String? activeConversationId,
    List<ChatMessage>? messages,
    bool? loading,
    String? error,
  }) {
    return ConversationsState(
      conversations: conversations ?? this.conversations,
      activeConversationId: activeConversationId,
      messages: messages ?? this.messages,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

class ConversationsController extends StateNotifier<ConversationsState> {
  ConversationsController(dynamic ref) : super(const ConversationsState()) {
    _load();
  }

  void _load() {
    state = state.copyWith(
      conversations: List<Conversation>.from(demoConversations),
      loading: false,
    );
  }

  void selectConversation(String id) {
    final messages = demoMessages[id] ?? [];
    state = state.copyWith(
      activeConversationId: id,
      messages: messages,
      conversations: state.conversations.map((c) {
        if (c.id == id) return c.copyWith(unreadCount: 0);
        return c;
      }).toList(),
    );
  }

  void sendMessage(String content) {
    if (content.trim().isEmpty || state.activeConversationId == null) return;

    final now = DateTime.now().toIso8601String();
    final msg = ChatMessage(
      id: 'msg-${DateTime.now().millisecondsSinceEpoch}',
      senderId: 'STU-2043',
      senderName: 'Aisha Karim',
      senderInitials: 'AK',
      content: content.trim(),
      type: 'text',
      createdAt: now,
    );

    state = state.copyWith(
      messages: [...state.messages, msg],
      conversations: state.conversations.map((c) {
        if (c.id == state.activeConversationId) {
          return c.copyWith(
            lastMessage: msg.content,
            lastSenderId: msg.senderId,
            lastMessageAt: now,
          );
        }
        return c;
      }).toList(),
    );
  }

  void startConversation(UserProfile user) {
    final existing = state.conversations.where((c) =>
        c.participants.any((p) => p.id == user.id)).toList();
    if (existing.isNotEmpty) {
      selectConversation(existing.first.id);
      return;
    }

    final now = DateTime.now().toIso8601String();
    final convId = 'conv-${DateTime.now().millisecondsSinceEpoch}';
    final conv = Conversation(
      id: convId,
      type: 'direct',
      title: user.name,
      createdAt: now,
      updatedAt: now,
      participants: [
        Participant(id: 'STU-2043', name: 'Aisha Karim', avatarInitials: 'AK', role: 'student'),
        Participant(id: user.id, name: user.name, avatarInitials: user.avatarInitials, role: user.role.key),
      ],
    );

    state = state.copyWith(
      conversations: [conv, ...state.conversations],
    );
    selectConversation(convId);
  }

  List<UserProfile> searchUsers(String query) {
    if (query.trim().isEmpty) return [];
    final q = query.toLowerCase();
    final myId = 'STU-2043';
    return mock.demoUsers.values
        .where((u) =>
            u.id != myId &&
            (u.name.toLowerCase().contains(q) ||
                u.id.toLowerCase().contains(q) ||
                u.email.toLowerCase().contains(q)))
        .toList();
  }

  void clearActive() {
    state = state.copyWith(activeConversationId: null, messages: []);
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsController, ConversationsState>(
  ConversationsController.new,
);
