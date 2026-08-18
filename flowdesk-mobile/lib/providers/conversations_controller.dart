import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/chat_mock_data.dart';
import '../models/chat_message.dart';

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
  ConversationsController() : super(const ConversationsState()) {
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
            updatedAt: now,
          );
        }
        return c;
      }).toList(),
    );
  }

  void refreshConversations() {
    state = state.copyWith(loading: true);
    _load();
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsController, ConversationsState>(
  ConversationsController.new,
);
