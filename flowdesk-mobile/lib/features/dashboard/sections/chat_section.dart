import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../models/chat_message.dart';
import '../../../providers/auth_controller.dart';
import '../../../providers/conversations_controller.dart';

class ChatSection extends ConsumerStatefulWidget {
  const ChatSection({super.key});

  @override
  ConsumerState<ChatSection> createState() => _ChatSectionState();
}

class _ChatSectionState extends ConsumerState<ChatSection> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _inputController.text;
    if (text.trim().isEmpty) return;
    ref.read(conversationsProvider.notifier).sendMessage(text);
    _inputController.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final state = ref.watch(conversationsProvider);
    final myId = ref.watch(authProvider)?.id ?? 'STU-2043';

    return Row(
      children: [
        SizedBox(
          width: 320,
          child: _ConversationList(
            state: state,
            colors: colors,
            scheme: scheme,
            onSelect: (id) =>
                ref.read(conversationsProvider.notifier).selectConversation(id),
          ),
        ),
        const VerticalDivider(width: 1),
        Expanded(
          child: state.activeConversationId == null
              ? _EmptyChat(scheme: scheme)
              : _MessageThread(
                  messages: state.messages,
                  myId: myId,
                  colors: colors,
                  scheme: scheme,
                  conversation: state.activeConversation,
                  scrollController: _scrollController,
                  inputController: _inputController,
                  onSend: _send,
                ),
        ),
      ],
    );
  }
}

class _ConversationList extends StatelessWidget {
  const _ConversationList({
    required this.state,
    required this.colors,
    required this.scheme,
    required this.onSelect,
  });

  final ConversationsState state;
  final AppColors colors;
  final ColorScheme scheme;
  final ValueChanged<String> onSelect;

  String _formatTime(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dt.day}/${dt.month}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Text(
            'Messages',
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        Expanded(
          child: state.conversations.isEmpty
              ? const Center(child: Text('No conversations yet'))
              : ListView.builder(
                  itemCount: state.conversations.length,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemBuilder: (context, index) {
                    final conv = state.conversations[index];
                    final isActive = conv.id == state.activeConversationId;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: GlassCard(
                        color: isActive
                            ? colors.chart1.withValues(alpha: 0.08)
                            : null,
                        onTap: () => onSelect(conv.id),
                        padding: const EdgeInsets.all(12),
                        borderRadius: 12,
                        child: Row(
                          children: [
                            Avatar(
                              initials: conv.participants
                                      .where((p) => p.id != 'STU-2043')
                                      .firstOrNull
                                      ?.avatarInitials ??
                                  conv.title.substring(0, 2).toUpperCase(),
                              size: 40,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    conv.title,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      color: isActive ? colors.chart1 : null,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    conv.lastMessage ?? '',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  _formatTime(conv.lastMessageAt),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    color: scheme.onSurfaceVariant,
                                  ),
                                ),
                                if (conv.unreadCount > 0) ...[
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: colors.chart1,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      '${conv.unreadCount}',
                                      style: TextStyle(
                                        color: scheme.onPrimary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat({required this.scheme});

  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.chat_bubble_outline_rounded,
              size: 48, color: scheme.onSurfaceVariant.withValues(alpha: 0.4)),
          const SizedBox(height: 12),
          Text(
            'Select a conversation',
            style: TextStyle(
                fontSize: 16, color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _MessageThread extends StatelessWidget {
  const _MessageThread({
    required this.messages,
    required this.myId,
    required this.colors,
    required this.scheme,
    this.conversation,
    required this.scrollController,
    required this.inputController,
    required this.onSend,
  });

  final List<ChatMessage> messages;
  final String myId;
  final AppColors colors;
  final ColorScheme scheme;
  final Conversation? conversation;
  final ScrollController scrollController;
  final TextEditingController inputController;
  final VoidCallback onSend;

  String _formatTimestamp(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: scheme.surface,
            border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
          ),
          child: Row(
            children: [
              if (conversation != null)
                Avatar(
                  initials: conversation!.participants
                          .where((p) => p.id != myId)
                          .firstOrNull
                          ?.avatarInitials ??
                      '??',
                  size: 32,
                ),
              const SizedBox(width: 10),
              Text(
                conversation?.title ?? '',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ],
          ),
        ),
        Expanded(
          child: messages.isEmpty
              ? const Center(child: Text('No messages yet'))
              : ListView.builder(
                  controller: scrollController,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final msg = messages[index];
                    final isMine = msg.senderId == myId;
                    return _MessageBubble(
                      message: msg,
                      isMine: isMine,
                      colors: colors,
                      scheme: scheme,
                      time: _formatTimestamp(msg.createdAt),
                    );
                  },
                ),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: scheme.surface,
            border: Border(top: BorderSide(color: scheme.outlineVariant)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: inputController,
                  onSubmitted: (_) => onSend(),
                  decoration: InputDecoration(
                    hintText: 'Type a message…',
                    hintStyle: TextStyle(color: scheme.onSurfaceVariant),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: scheme.outlineVariant),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: scheme.outlineVariant),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: colors.chart1, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.filled(
                onPressed: onSend,
                style: IconButton.styleFrom(
                  backgroundColor: colors.chart1,
                  foregroundColor: scheme.onPrimary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.all(10),
                ),
                icon: const Icon(Icons.send_rounded, size: 20),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.colors,
    required this.scheme,
    required this.time,
  });

  final ChatMessage message;
  final bool isMine;
  final AppColors colors;
  final ColorScheme scheme;
  final String time;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMine
              ? colors.chart1.withValues(alpha: 0.12)
              : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(isMine ? 14 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 14),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMine)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  message.senderName,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: colors.chart1,
                  ),
                ),
              ),
            Text(
              message.content,
              style: TextStyle(
                fontSize: 14,
                color: isMine ? colors.chart1 : scheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              time,
              style: TextStyle(
                fontSize: 11,
                fontFamily: 'monospace',
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
