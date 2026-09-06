import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../models/role.dart';
import '../../../providers/auth_controller.dart';
import 'widgets.dart';

class _Message {
  const _Message({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.time,
    this.isMe = false,
  });

  final String id;
  final String senderId;
  final String senderName;
  final String text;
  final String time;
  final bool isMe;
}

class _Conversation {
  _Conversation({
    required this.id,
    required this.peerName,
    required this.peerInitials,
    required this.peerRole,
    required this.lastMessage,
    required this.lastTime,
    this.unreadCount = 0,
    this.messages = const [],
  });

  final String id;
  final String peerName;
  final String peerInitials;
  final Role peerRole;
  String lastMessage;
  String lastTime;
  int unreadCount;
  final List<_Message> messages;
}

final _conversations = <_Conversation>[
  _Conversation(
    id: 'conv-1',
    peerName: 'Dr. Rahul Menon',
    peerInitials: 'RM',
    peerRole: Role.staff,
    lastMessage: 'Sure, bring your doubts to the Wednesday session.',
    lastTime: '10:32 AM',
    unreadCount: 2,
    messages: [
      _Message(id: 'm1', senderId: 'STU-2043', senderName: 'You', text: 'Hi Dr. Menon, I had a question about the AVL tree assignment.', time: '10:15 AM', isMe: true),
      _Message(id: 'm2', senderId: 'STF-118', senderName: 'Dr. Rahul Menon', text: 'Of course! Which problem specifically?', time: '10:20 AM'),
      _Message(id: 'm3', senderId: 'STU-2043', senderName: 'You', text: 'The rotation edge case when both children have balance factor +1.', time: '10:25 AM', isMe: true),
      _Message(id: 'm4', senderId: 'STF-118', senderName: 'Dr. Rahul Menon', text: 'Good question — that requires a double rotation. Check slide 34 from the last lecture.', time: '10:28 AM'),
      _Message(id: 'm5', senderId: 'STF-118', senderName: 'Dr. Rahul Menon', text: 'Sure, bring your doubts to the Wednesday session.', time: '10:32 AM'),
    ],
  ),
  _Conversation(
    id: 'conv-2',
    peerName: 'Dev Patel',
    peerInitials: 'DP',
    peerRole: Role.student,
    lastMessage: 'Can you share the notes from today?',
    lastTime: '9:45 AM',
    unreadCount: 1,
    messages: [
      _Message(id: 'm6', senderId: 'STU-2044', senderName: 'Dev Patel', text: 'Hey, were you in class today? I missed the first hour.', time: '9:30 AM'),
      _Message(id: 'm7', senderId: 'STU-2043', senderName: 'You', text: 'Yeah I was. What happened?', time: '9:35 AM', isMe: true),
      _Message(id: 'm8', senderId: 'STU-2044', senderName: 'Dev Patel', text: 'Can you share the notes from today?', time: '9:45 AM'),
    ],
  ),
  _Conversation(
    id: 'conv-3',
    peerName: 'Dr. Neha Gupta',
    peerInitials: 'NG',
    peerRole: Role.staff,
    lastMessage: 'Project submission deadline extended to Friday.',
    lastTime: 'Yesterday',
    messages: [
      _Message(id: 'm9', senderId: 'STF-119', senderName: 'Dr. Neha Gupta', text: 'The DB project deadline has been extended.', time: 'Yesterday'),
      _Message(id: 'm10', senderId: 'STF-119', senderName: 'Dr. Neha Gupta', text: 'Project submission deadline extended to Friday.', time: 'Yesterday'),
    ],
  ),
  _Conversation(
    id: 'conv-4',
    peerName: 'Priya Sharma',
    peerInitials: 'PS',
    peerRole: Role.admin,
    lastMessage: 'Your scholarship application has been received.',
    lastTime: 'Mon',
    messages: [
      _Message(id: 'm11', senderId: 'ADM-004', senderName: 'Priya Sharma', text: 'Your scholarship application has been received.', time: 'Mon'),
    ],
  ),
];

class ChatSection extends ConsumerStatefulWidget {
  const ChatSection({super.key});

  @override
  ConsumerState<ChatSection> createState() => _ChatSectionState();
}

class _ChatSectionState extends ConsumerState<ChatSection> {
  _Conversation? _active;
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty || _active == null) return;
    final user = ref.read(authProvider);
    if (user == null) return;

    setState(() {
      _active!.messages.add(_Message(
        id: 'msg-${DateTime.now().millisecondsSinceEpoch}',
        senderId: user.id,
        senderName: 'You',
        text: text,
        time: 'Now',
        isMe: true,
      ));
      _active!.lastMessage = text;
      _active!.lastTime = 'Now';
    });
    _controller.clear();

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
    if (_active != null) {
      return _ThreadView(
        conversation: _active!,
        onBack: () => setState(() => _active = null),
        controller: _controller,
        scrollController: _scrollController,
        onSend: _send,
      );
    }
    return _ConversationList(
      conversations: _conversations,
      onSelect: (c) {
        setState(() {
          c.unreadCount = 0;
          _active = c;
        });
      },
    );
  }
}

class _ConversationList extends StatelessWidget {
  const _ConversationList({
    required this.conversations,
    required this.onSelect,
  });

  final List<_Conversation> conversations;
  final ValueChanged<_Conversation> onSelect;

  @override
  Widget build(BuildContext context) {
    return SectionScaffold(
      title: 'Messages',
      description: 'Peer-to-peer conversations with staff, students and administrators.',
      children: [
        if (conversations.isEmpty)
          const GlassCard(child: EmptyState(message: 'No conversations yet.', icon: Icons.message_outlined))
        else
          for (final conv in conversations)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ConversationTile(
                conversation: conv,
                onTap: () => onSelect(conv),
              ),
            ),
      ],
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation, required this.onTap});

  final _Conversation conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    final conv = conversation;

    return GlassCard(
      onTap: onTap,
      child: Row(
        children: [
          Avatar(initials: conv.peerInitials, size: 42),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        conv.peerName,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      conv.lastTime,
                      style: TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        conv.lastMessage,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (conv.unreadCount > 0) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: colors.chart1,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${conv.unreadCount}',
                          style: const TextStyle(
                            color: Colors.white,
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
        ],
      ),
    );
  }
}

class _ThreadView extends StatelessWidget {
  const _ThreadView({
    required this.conversation,
    required this.onBack,
    required this.controller,
    required this.scrollController,
    required this.onSend,
  });

  final _Conversation conversation;
  final VoidCallback onBack;
  final TextEditingController controller;
  final ScrollController scrollController;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    final conv = conversation;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              IconButton(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_rounded, size: 22),
                tooltip: 'Back',
              ),
              Avatar(initials: conv.peerInitials, size: 36),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(conv.peerName,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    Text(conv.peerRole.label,
                        style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: conv.messages.isEmpty
                ? const EmptyState(message: 'No messages yet. Say hello!', icon: Icons.chat_bubble_outline)
                : ListView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    itemCount: conv.messages.length,
                    itemBuilder: (context, i) => _MessageBubble(
                      message: conv.messages[i],
                      colors: colors,
                      scheme: scheme,
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 12),
        GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    hintText: 'Type a message…',
                    isDense: true,
                    border: InputBorder.none,
                  ),
                  onSubmitted: (_) => onSend(),
                  textInputAction: TextInputAction.send,
                ),
              ),
              IconButton(
                onPressed: onSend,
                icon: Icon(Icons.send_rounded, color: colors.chart1),
                tooltip: 'Send',
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
    required this.colors,
    required this.scheme,
  });

  final _Message message;
  final AppColors colors;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final isMe = message.isMe;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe
              ? colors.chart1.withValues(alpha: 0.15)
              : scheme.surfaceContainerHighest.withValues(alpha: 0.6),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(isMe ? 14 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 14),
          ),
          border: Border.all(
            color: isMe
                ? colors.chart1.withValues(alpha: 0.25)
                : scheme.outlineVariant,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isMe)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  message.senderName,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: colors.chart1,
                  ),
                ),
              ),
            Text(message.text, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.bottomRight,
              child: Text(
                message.time,
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
