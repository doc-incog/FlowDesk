import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/chat.dart';
import '../../data/chat_data.dart';

class _ChatMessage {
  const _ChatMessage(this.fromBot, this.text);

  final bool fromBot;
  final String text;
}

class AIChat extends StatefulWidget {
  const AIChat({super.key});

  @override
  State<AIChat> createState() => _AIChatState();
}

class _AIChatState extends State<AIChat> {
  bool _open = false;
  bool _typing = false;
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <_ChatMessage>[
    const _ChatMessage(
        true,
        'Hi! I am Flow, your campus assistant. Ask me about fees, exams, '
        'admissions, scholarships, timings or anything else.'),
  ];

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send(String raw) {
    final text = raw.trim();
    if (text.isEmpty || _typing) return;
    setState(() {
      _messages.add(_ChatMessage(false, text));
      _typing = true;
    });
    _input.clear();
    _scrollToEnd();
    Future<void>.delayed(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatMessage(true, answerFor(text)));
        _typing = false;
      });
      _scrollToEnd();
    });
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
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

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (_open)
          Container(
            width: MediaQuery.of(context).size.width.clamp(0, 352),
            height: MediaQuery.of(context).size.height * 0.55,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: scheme.surface.withValues(alpha: 0.97),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: scheme.outlineVariant),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerHighest.withValues(alpha: 0.6),
                    border: Border(
                        bottom: BorderSide(color: scheme.outlineVariant)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: colors.chart1,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.smart_toy_outlined,
                            color: Colors.white, size: 19),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Flow Assistant',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 14)),
                            Row(
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.green,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text('Online · campus knowledge base',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: scheme.onSurfaceVariant)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(() => _open = false),
                        icon: Icon(Icons.close_rounded,
                            size: 20, color: scheme.onSurfaceVariant),
                        tooltip: 'Close chat',
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length + (_typing ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (_typing && index == _messages.length) {
                        return const _TypingBubble();
                      }
                      return _MessageBubble(message: _messages[index]);
                    },
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    border: Border(
                        top: BorderSide(color: scheme.outlineVariant)),
                  ),
                  child: Column(
                    children: [
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final s in chatSuggestions)
                              Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: _SuggestionChip(text: s, onTap: () => _send(s)),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _input,
                              onSubmitted: _send,
                              textInputAction: TextInputAction.send,
                              decoration: InputDecoration(
                                hintText: 'Ask about the campus…',
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            onPressed: _input.text.trim().isEmpty || _typing
                                ? null
                                : () => _send(_input.text),
                            icon: const Icon(Icons.send_rounded, size: 18),
                            tooltip: 'Send message',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        FloatingActionButton(
          onPressed: () {
            setState(() => _open = !_open);
            if (_open) _scrollToEnd();
          },
          backgroundColor: colors.chart1,
          foregroundColor: scheme.onPrimary,
          tooltip: _open ? 'Close assistant' : 'Open assistant',
          child: Icon(
              _open ? Icons.close_rounded : Icons.smart_toy_outlined, size: 24),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;

    return Align(
      alignment: message.fromBot ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        constraints: const BoxConstraints(maxWidth: 260),
        decoration: BoxDecoration(
          color: message.fromBot
              ? scheme.surfaceContainerHighest.withValues(alpha: 0.7)
              : colors.chart1,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft:
                Radius.circular(message.fromBot ? 4 : 14),
            bottomRight:
                Radius.circular(message.fromBot ? 14 : 4),
          ),
          border: message.fromBot
              ? Border.all(color: scheme.outlineVariant)
              : null,
        ),
        child: Text(
          message.text,
          style: TextStyle(
            fontSize: 13,
            height: 1.4,
            color: message.fromBot ? scheme.onSurface : scheme.onPrimary,
          ),
        ),
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: scheme.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 3; i++)
              Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: scheme.onSurfaceVariant,
                ),
                child: i == 0 ? const SizedBox() : null,
              ),
          ],
        ),
      ),
    );
  }
}

class _SuggestionChip extends StatelessWidget {
  const _SuggestionChip({required this.text, required this.onTap});

  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: scheme.outline),
          color: scheme.surfaceContainerLow,
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: scheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
