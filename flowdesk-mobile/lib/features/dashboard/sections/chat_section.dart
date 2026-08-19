import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../models/conversation.dart';
import '../../../models/user.dart';
import '../../../providers/auth_controller.dart';
import '../../../providers/conversations_controller.dart';
import 'widgets.dart';

class ChatSection extends ConsumerStatefulWidget {
  const ChatSection({super.key});

  @override
  ConsumerState<ChatSection> createState() => _ChatSectionState();
}

class _ChatSectionState extends ConsumerState<ChatSection> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  final _convFilterController = TextEditingController();
  List<UserProfile> _searchResults = [];
  bool _showNewChat = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      ref.read(conversationsProvider.notifier).refreshMessages();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _inputController.dispose();
    _scrollController.dispose();
    _searchController.dispose();
    _convFilterController.dispose();
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

  void _search(String query) {
    final results = ref.read(conversationsProvider.notifier).searchUsers(query);
    setState(() => _searchResults = results);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final state = ref.watch(conversationsProvider);
    final myId = ref.watch(authProvider)?.id ?? 'STU-2043';
    final isWide = Breakpoints.isTablet(context) || Breakpoints.isWide(context);

    if (isWide) {
      return _WideLayout(
        state: state,
        myId: myId,
        colors: colors,
        scheme: scheme,
        scrollController: _scrollController,
        inputController: _inputController,
        onSend: _send,
        onSelect: (id) => ref.read(conversationsProvider.notifier).selectConversation(id),
        onBack: () => ref.read(conversationsProvider.notifier).clearActive(),
        showNewChat: _showNewChat,
        onToggleNewChat: () => setState(() => _showNewChat = !_showNewChat),
        searchController: _searchController,
        searchResults: _searchResults,
        onSearch: _search,
        onStartConversation: (user) {
          ref.read(conversationsProvider.notifier).startConversation(user);
          setState(() {
            _showNewChat = false;
            _searchController.clear();
            _searchResults = [];
          });
        },
        filterController: _convFilterController,
        filterQuery: _convFilterController.text,
      );
    }

    if (state.activeConversationId != null) {
      return _MessageThread(
        conversation: state.activeConversation,
        messages: state.messages,
        myId: myId,
        colors: colors,
        scheme: scheme,
        scrollController: _scrollController,
        inputController: _inputController,
        onSend: _send,
        onBack: () => ref.read(conversationsProvider.notifier).clearActive(),
      );
    }

    return _ConversationList(
      state: state,
      myId: myId,
      colors: colors,
      scheme: scheme,
      onSelect: (id) => ref.read(conversationsProvider.notifier).selectConversation(id),
      showNewChat: _showNewChat,
      onToggleNewChat: () => setState(() => _showNewChat = !_showNewChat),
      searchController: _searchController,
      searchResults: _searchResults,
      onSearch: _search,
      onStartConversation: (user) {
        ref.read(conversationsProvider.notifier).startConversation(user);
        setState(() {
          _showNewChat = false;
          _searchController.clear();
          _searchResults = [];
        });
      },
      filterController: _convFilterController,
      filterQuery: _convFilterController.text,
    );
  }
}

String _relativeTime(String? iso) {
  if (iso == null) return '';
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return '${dt.day}/${dt.month}';
}

class _ConversationList extends StatelessWidget {
  const _ConversationList({
    required this.state,
    required this.myId,
    required this.colors,
    required this.scheme,
    required this.onSelect,
    required this.showNewChat,
    required this.onToggleNewChat,
    required this.searchController,
    required this.searchResults,
    required this.onSearch,
    required this.onStartConversation,
    required this.filterController,
    required this.filterQuery,
  });

  final ConversationsState state;
  final String myId;
  final AppColors colors;
  final ColorScheme scheme;
  final ValueChanged<String> onSelect;
  final bool showNewChat;
  final VoidCallback onToggleNewChat;
  final TextEditingController searchController;
  final List<UserProfile> searchResults;
  final ValueChanged<String> onSearch;
  final ValueChanged<UserProfile> onStartConversation;
  final TextEditingController filterController;
  final String filterQuery;

  @override
  Widget build(BuildContext context) {
    final q = filterQuery.toLowerCase();
    final filtered = q.isEmpty
        ? state.conversations
        : state.conversations
            .where((c) => c.title.toLowerCase().contains(q))
            .toList();

    return SectionScaffold(
      title: 'Messages',
      description: 'Chat with students, staff, and administrators.',
      action: FilledButton.icon(
        onPressed: onToggleNewChat,
        icon: Icon(showNewChat ? Icons.close : Icons.add_rounded, size: 18),
        label: Text(showNewChat ? 'Cancel' : 'New chat'),
      ),
      children: [
        if (!showNewChat)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TextField(
              controller: filterController,
              onChanged: (_) {},
              decoration: InputDecoration(
                hintText: 'Search conversations…',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                isDense: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        if (showNewChat) ...[
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Start a new conversation',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                TextField(
                  controller: searchController,
                  onChanged: onSearch,
                  decoration: InputDecoration(
                    hintText: 'Search people by name or ID…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                if (searchResults.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  for (final u in searchResults)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Avatar(initials: u.avatarInitials, size: 36),
                      title: Text(u.name,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${u.role.label} · ${u.department}',
                          style: TextStyle(
                              fontSize: 12, color: scheme.onSurfaceVariant)),
                      onTap: () => onStartConversation(u),
                    ),
                ] else if (searchController.text.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('No users found.',
                      style: TextStyle(
                          fontSize: 12, color: scheme.onSurfaceVariant)),
                ],
              ],
            ),
          ),
        ],
        if (filtered.isEmpty)
          const GlassCard(
            child: EmptyState(
              message: 'No conversations yet. Start one by tapping "New chat".',
              icon: Icons.chat_bubble_outline_rounded,
            ),
          )
        else
          for (final conv in filtered)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GlassCard(
                onTap: () => onSelect(conv.id),
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Avatar(
                      initials: conv.participants
                              .where((p) => p.id != myId)
                              .firstOrNull
                              ?.avatarInitials ??
                          conv.title.substring(0, 2).toUpperCase(),
                      size: 44,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  conv.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600, fontSize: 14),
                                ),
                              ),
                              if (conv.lastMessageAt != null)
                                Text(
                                  _relativeTime(conv.lastMessageAt),
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontFamily: 'monospace',
                                      color: scheme.onSurfaceVariant),
                                ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  conv.lastMessage ?? 'No messages yet',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: scheme.onSurfaceVariant),
                                ),
                              ),
                              if (conv.unreadCount > 0) ...[
                                const SizedBox(width: 8),
                                Pill(
                                  text: '${conv.unreadCount}',
                                  color: colors.chart1,
                                  compact: true,
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _MessageThread extends StatelessWidget {
  const _MessageThread({
    required this.conversation,
    required this.messages,
    required this.myId,
    required this.colors,
    required this.scheme,
    required this.scrollController,
    required this.inputController,
    required this.onSend,
    required this.onBack,
  });

  final Conversation? conversation;
  final List<ChatMessage> messages;
  final String myId;
  final AppColors colors;
  final ColorScheme scheme;
  final ScrollController scrollController;
  final TextEditingController inputController;
  final VoidCallback onSend;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final other = conversation?.participants.where((p) => p.id != myId).firstOrNull;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: onBack,
          tooltip: 'Back to conversations',
        ),
        title: Row(
          children: [
            if (other != null) Avatar(initials: other.avatarInitials, size: 32),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(other?.name ?? conversation?.title ?? '',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
                  if (conversation != null)
                    Text(
                      '${conversation!.participants.length} participant${conversation!.participants.length == 1 ? '' : 's'}',
                      style: TextStyle(
                          fontSize: 11, color: scheme.onSurfaceVariant),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.chat_bubble_outline_rounded,
                            size: 48,
                            color: scheme.onSurfaceVariant.withValues(alpha: 0.4)),
                        const SizedBox(height: 12),
                        Text('No messages yet. Say hello!',
                            style: TextStyle(color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      final isMine = msg.senderId == myId;
                      return _MessageBubble(
                        message: msg,
                        isMine: isMine,
                        colors: colors,
                        scheme: scheme,
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
                        borderSide:
                            BorderSide(color: colors.chart1, width: 1.5),
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
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.colors,
    required this.scheme,
  });

  final ChatMessage message;
  final bool isMine;
  final AppColors colors;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
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
              _relativeTime(message.createdAt),
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

class _WideLayout extends StatelessWidget {
  const _WideLayout({
    required this.state,
    required this.myId,
    required this.colors,
    required this.scheme,
    required this.scrollController,
    required this.inputController,
    required this.onSend,
    required this.onSelect,
    required this.onBack,
    required this.showNewChat,
    required this.onToggleNewChat,
    required this.searchController,
    required this.searchResults,
    required this.onSearch,
    required this.onStartConversation,
    required this.filterController,
    required this.filterQuery,
  });

  final ConversationsState state;
  final String myId;
  final AppColors colors;
  final ColorScheme scheme;
  final ScrollController scrollController;
  final TextEditingController inputController;
  final VoidCallback onSend;
  final ValueChanged<String> onSelect;
  final VoidCallback onBack;
  final bool showNewChat;
  final VoidCallback onToggleNewChat;
  final TextEditingController searchController;
  final List<UserProfile> searchResults;
  final ValueChanged<String> onSearch;
  final ValueChanged<UserProfile> onStartConversation;
  final TextEditingController filterController;
  final String filterQuery;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 320,
          child: _ConversationList(
            state: state,
            myId: myId,
            colors: colors,
            scheme: scheme,
            onSelect: onSelect,
            showNewChat: showNewChat,
            onToggleNewChat: onToggleNewChat,
            searchController: searchController,
            searchResults: searchResults,
            onSearch: onSearch,
            onStartConversation: onStartConversation,
            filterController: filterController,
            filterQuery: filterQuery,
          ),
        ),
        const VerticalDivider(width: 1),
        Expanded(
          child: state.activeConversationId == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.chat_bubble_outline_rounded,
                          size: 48,
                          color: scheme.onSurfaceVariant.withValues(alpha: 0.4)),
                      const SizedBox(height: 12),
                      Text('Select a conversation',
                          style: TextStyle(
                              fontSize: 16, color: scheme.onSurfaceVariant)),
                    ],
                  ),
                )
              : _MessageThread(
                  conversation: state.activeConversation,
                  messages: state.messages,
                  myId: myId,
                  colors: colors,
                  scheme: scheme,
                  scrollController: scrollController,
                  inputController: inputController,
                  onSend: onSend,
                  onBack: onBack,
                ),
        ),
      ],
    );
  }
}
