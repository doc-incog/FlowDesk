import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Five-star rating control; read-only unless onChanged is provided.
class RatingStars extends StatelessWidget {
  const RatingStars({
    super.key,
    required this.value,
    this.onChanged,
    this.size = 26,
  });

  final int value;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          GestureDetector(
            onTap: onChanged == null ? null : () => onChanged!(i),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Icon(
                i <= value ? Icons.star_rounded : Icons.star_outline_rounded,
                color: i <= value ? colors.warning : colors.chart5.withValues(alpha: 0.5),
                size: size,
              ),
            ),
          ),
      ],
    );
  }
}

String ratingLabel(int value) => switch (value) {
      5 => 'Excellent',
      4 => 'Very good',
      3 => 'Good',
      2 => 'Poor',
      _ => 'Very poor',
    };
