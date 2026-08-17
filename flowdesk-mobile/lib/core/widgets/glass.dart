import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/responsive.dart';

/// Frosted glass surface mirroring the web app's .glass-strong style.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    this.child,
    this.padding,
    this.margin,
    this.color,
    this.onTap,
    this.borderRadius = 16,
  });

  final Widget? child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final VoidCallback? onTap;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fill = color ?? scheme.surface.withValues(alpha: 0.72);
    final isPhone = Breakpoints.isPhone(context);
    final blur = isPhone ? 12.0 : 18.0;

    Widget content = Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: scheme.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: blur,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );

    content = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: content,
      ),
    );

    if (onTap != null) {
      content = InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(borderRadius),
        child: content,
      );
    }

    return Container(margin: margin, child: content);
  }
}

/// Soft ambient colour blobs behind the glass (mirrors .ambient::before).
class AmbientBackground extends StatelessWidget {
  const AmbientBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;

    return Stack(
      fit: StackFit.expand,
      children: [
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Theme.of(context).scaffoldBackgroundColor,
                Theme.of(context)
                    .colorScheme
                    .surfaceContainerLow
                    .withValues(alpha: 0.6),
              ],
            ),
          ),
        ),
        _Blob(color: colors.chart1, top: -80, left: -60, size: 240),
        _Blob(color: colors.chart2, top: 120, right: -80, size: 260),
        _Blob(color: colors.chart3, bottom: -100, left: 40, size: 280),
        _Blob(color: colors.chart5, top: -40, right: 80, size: 200),
        child,
      ],
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({
    required this.color,
    this.top,
    this.bottom,
    this.left,
    this.right,
    required this.size,
  });

  final Color color;
  final double? top;
  final double? bottom;
  final double? left;
  final double? right;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: IgnorePointer(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: 0.12),
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
