import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Underline-style tab bar mirroring the web app's SectionTabs.
class SectionTabs<T> extends StatelessWidget {
  const SectionTabs({
    super.key,
    required this.tabs,
    required this.active,
    required this.onChanged,
    this.labels,
  });

  final List<T> tabs;
  final T active;
  final ValueChanged<T> onChanged;
  final String Function(T)? labels;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final tab in tabs)
            Padding(
              padding: const EdgeInsets.only(right: 18),
              child: InkWell(
                onTap: () => onChanged(tab),
                borderRadius: BorderRadius.circular(8),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: tab == active ? colors.chart1 : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    (labels ?? (t) => t.toString())(tab).toUpperCase(),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.6,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color: tab == active ? colors.chart1 : scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.value, this.color, this.height = 8});

  final double value;
  final Color? color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final clamped = value.clamp(0, 100);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: LinearProgressIndicator(
        value: clamped / 100,
        minHeight: height,
        color: color ?? scheme.primary,
        backgroundColor: scheme.surfaceContainerHighest,
      ),
    );
  }
}
