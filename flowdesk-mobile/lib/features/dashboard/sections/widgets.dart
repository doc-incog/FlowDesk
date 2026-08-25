import 'package:flutter/material.dart';

/// Standard vertical rhythm for a section page.
class SectionScaffold extends StatelessWidget {
  const SectionScaffold({
    super.key,
    required this.title,
    this.description,
    this.action,
    this.children = const [],
  });

  final String title;
  final String? description;
  final Widget? action;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                    if (description != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        description!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ],
                ),
              ),
              ?action,
            ],
          ),
        ),
        for (final c in children) ...[c, const SizedBox(height: 16)],
      ],
    );
  }
}

/// Two-column responsive card grid.
class CardGrid extends StatelessWidget {
  const CardGrid({super.key, required this.children, this.spacing = 12});

  final List<Widget> children;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - spacing) / 2;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [for (final c in children) SizedBox(width: width, child: c)],
        );
      },
    );
  }
}

/// Generic empty state.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.message, this.icon = Icons.inbox_outlined});

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Icon(icon, size: 36, color: scheme.onSurfaceVariant.withValues(alpha: 0.6)),
          const SizedBox(height: 8),
          Text(message,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: scheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}
