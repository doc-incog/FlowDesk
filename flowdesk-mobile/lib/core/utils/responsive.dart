import 'package:flutter/material.dart';

/// Screen size breakpoints for FlowDesk mobile app.
enum Breakpoint {
  /// < 600px — phones in portrait
  compact,

  /// 600–840px — phones in landscape, small tablets
  medium,

  /// 840–1200px — tablets
  expanded,

  /// > 1200px — large tablets, desktop
  large,
}

/// Returns the current [Breakpoint] for the given [width].
Breakpoint breakpointFor(double width) {
  if (width >= 1200) return Breakpoint.large;
  if (width >= 840) return Breakpoint.expanded;
  if (width >= 600) return Breakpoint.medium;
  return Breakpoint.compact;
}

/// InheritedNotifier that provides the current [Breakpoint] to descendants.
class ResponsiveLayout extends InheritedWidget {
  const ResponsiveLayout({
    super.key,
    required this.breakpoint,
    required this.screenWidth,
    required super.child,
  });

  final Breakpoint breakpoint;
  final double screenWidth;

  static ResponsiveLayout of(BuildContext context) {
    final result = context.dependOnInheritedWidgetOfExactType<ResponsiveLayout>();
    assert(result != null, 'No ResponsiveLayout found in context');
    return result!;
  }

  static Breakpoint breakpointOf(BuildContext context) =>
      of(context).breakpoint;

  static bool isCompact(BuildContext context) =>
      breakpointOf(context) == Breakpoint.compact;

  static bool isMedium(BuildContext context) =>
      breakpointOf(context) == Breakpoint.medium;

  static bool isExpanded(BuildContext context) =>
      breakpointOf(context) == Breakpoint.expanded;

  static bool isLarge(BuildContext context) =>
      breakpointOf(context) == Breakpoint.large;

  static bool isCompactOrLess(BuildContext context) =>
      breakpointOf(context).index <= Breakpoint.compact.index;

  static bool isMediumOrLess(BuildContext context) =>
      breakpointOf(context).index <= Breakpoint.medium.index;

  @override
  bool updateShouldNotify(ResponsiveLayout oldWidget) =>
      breakpoint != oldWidget.breakpoint || screenWidth != oldWidget.screenWidth;
}

/// A widget that wraps its child in a [ResponsiveLayout] based on screen size.
class ResponsiveBuilder extends StatelessWidget {
  const ResponsiveBuilder({super.key, required this.builder});

  final Widget Function(BuildContext context, Breakpoint breakpoint) builder;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final bp = breakpointFor(constraints.maxWidth);
        return ResponsiveLayout(
          breakpoint: bp,
          screenWidth: constraints.maxWidth,
          child: builder(context, bp),
        );
      },
    );
  }
}

/// Extension on [BuildContext] for convenient responsive checks.
extension ResponsiveContext on BuildContext {
  Breakpoint get breakpoint => ResponsiveLayout.breakpointOf(this);
  bool get isCompact => ResponsiveLayout.isCompact(this);
  bool get isMedium => ResponsiveLayout.isMedium(this);
  bool get isExpanded => ResponsiveLayout.isExpanded(this);
  bool get isLarge => ResponsiveLayout.isLarge(this);
  bool get isCompactOrLess => ResponsiveLayout.isCompactOrLess(this);
  bool get isMediumOrLess => ResponsiveLayout.isMediumOrLess(this);
}

/// Returns responsive horizontal padding based on the current breakpoint.
EdgeInsets responsivePadding(BuildContext context) {
  final bp = context.breakpoint;
  switch (bp) {
    case Breakpoint.compact:
      return const EdgeInsets.symmetric(horizontal: 16);
    case Breakpoint.medium:
      return const EdgeInsets.symmetric(horizontal: 24);
    case Breakpoint.expanded:
    case Breakpoint.large:
      return const EdgeInsets.symmetric(horizontal: 32);
  }
}

/// Returns the number of columns for a card grid based on screen width.
int responsiveColumns(BuildContext context) {
  final bp = context.breakpoint;
  switch (bp) {
    case Breakpoint.compact:
      return 1;
    case Breakpoint.medium:
      return 2;
    case Breakpoint.expanded:
      return 3;
    case Breakpoint.large:
      return 4;
  }
}
