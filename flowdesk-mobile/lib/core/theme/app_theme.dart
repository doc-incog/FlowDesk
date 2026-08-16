import 'package:flutter/material.dart';

/// Ported from the web app's OKLCH design tokens (app/globals.css).
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.success,
    required this.successForeground,
    required this.warning,
    required this.warningForeground,
    required this.sidebar,
    required this.sidebarForeground,
    required this.sidebarAccent,
    required this.sidebarBorder,
    required this.chart1,
    required this.chart2,
    required this.chart3,
    required this.chart4,
    required this.chart5,
  });

  final Color success;
  final Color successForeground;
  final Color warning;
  final Color warningForeground;
  final Color sidebar;
  final Color sidebarForeground;
  final Color sidebarAccent;
  final Color sidebarBorder;
  final Color chart1;
  final Color chart2;
  final Color chart3;
  final Color chart4;
  final Color chart5;

  @override
  AppColors copyWith({
    Color? success,
    Color? successForeground,
    Color? warning,
    Color? warningForeground,
    Color? sidebar,
    Color? sidebarForeground,
    Color? sidebarAccent,
    Color? sidebarBorder,
    Color? chart1,
    Color? chart2,
    Color? chart3,
    Color? chart4,
    Color? chart5,
  }) {
    return AppColors(
      success: success ?? this.success,
      successForeground: successForeground ?? this.successForeground,
      warning: warning ?? this.warning,
      warningForeground: warningForeground ?? this.warningForeground,
      sidebar: sidebar ?? this.sidebar,
      sidebarForeground: sidebarForeground ?? this.sidebarForeground,
      sidebarAccent: sidebarAccent ?? this.sidebarAccent,
      sidebarBorder: sidebarBorder ?? this.sidebarBorder,
      chart1: chart1 ?? this.chart1,
      chart2: chart2 ?? this.chart2,
      chart3: chart3 ?? this.chart3,
      chart4: chart4 ?? this.chart4,
      chart5: chart5 ?? this.chart5,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      success: Color.lerp(success, other.success, t)!,
      successForeground: Color.lerp(successForeground, other.successForeground, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningForeground: Color.lerp(warningForeground, other.warningForeground, t)!,
      sidebar: Color.lerp(sidebar, other.sidebar, t)!,
      sidebarForeground: Color.lerp(sidebarForeground, other.sidebarForeground, t)!,
      sidebarAccent: Color.lerp(sidebarAccent, other.sidebarAccent, t)!,
      sidebarBorder: Color.lerp(sidebarBorder, other.sidebarBorder, t)!,
      chart1: Color.lerp(chart1, other.chart1, t)!,
      chart2: Color.lerp(chart2, other.chart2, t)!,
      chart3: Color.lerp(chart3, other.chart3, t)!,
      chart4: Color.lerp(chart4, other.chart4, t)!,
      chart5: Color.lerp(chart5, other.chart5, t)!,
    );
  }
}

const _light = AppColors(
  success: Color(0xFF266741),
  successForeground: Color(0xFFf8fafd),
  warning: Color(0xFFc78200),
  warningForeground: Color(0xFF402712),
  sidebar: Color(0xFFf8fafd),
  sidebarForeground: Color(0xFF242930),
  sidebarAccent: Color(0xFFe9edf1),
  sidebarBorder: Color(0xFFdadee3),
  chart1: Color(0xFFba2c25),
  chart2: Color(0xFF266741),
  chart3: Color(0xFFc78200),
  chart4: Color(0xFFc50516),
  chart5: Color(0xFF667383),
);

const _dark = AppColors(
  success: Color(0xFF5bac7a),
  successForeground: Color(0xFF070e16),
  warning: Color(0xFFdea645),
  warningForeground: Color(0xFF071727),
  sidebar: Color(0xFF161a1e),
  sidebarForeground: Color(0xFFdbdee2),
  sidebarAccent: Color(0xFF292e34),
  sidebarBorder: Color(0x1Fffffff),
  chart1: Color(0xFFea6c5a),
  chart2: Color(0xFF5bac7a),
  chart3: Color(0xFFdea645),
  chart4: Color(0xFFe95048),
  chart5: Color(0xFF9099a5),
);

ThemeData buildFlowDeskTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final colors = dark ? _dark : _light;

  final scheme = ColorScheme.fromSeed(
    seedColor: colors.chart1,
    brightness: brightness,
    primary: colors.chart1,
    onPrimary: dark ? const Color(0xFF070e16) : const Color(0xFFf8fafd),
    secondary: dark ? const Color(0xFF25292e) : const Color(0xFFeaedf1),
    onSecondary: dark ? const Color(0xFFe5e8ec) : const Color(0xFF282e37),
    surface: dark ? const Color(0xFF191d22) : const Color(0xFFFFFFFF),
    onSurface: dark ? const Color(0xFFe5e8ec) : const Color(0xFF171b20),
    error: dark ? const Color(0xFFe95048) : const Color(0xFFc50516),
    onError: dark ? const Color(0xFF070e16) : const Color(0xFFf8fafd),
    outline: dark ? const Color(0x1Fffffff) : const Color(0xFFd7dbe0),
    outlineVariant: dark ? const Color(0x29ffffff) : const Color(0xFFd0d5d9),
    surfaceContainerHighest: dark ? const Color(0xFF25292e) : const Color(0xFFeaedf1),
    surfaceContainerHigh: dark ? const Color(0xFF1c2127) : const Color(0xFFf2f4f7),
    surfaceContainer: dark ? const Color(0xFF191d22) : const Color(0xFFf8fafd),
    surfaceContainerLow: dark ? const Color(0xFF171b20) : const Color(0xFFfbfcfd),
    surfaceContainerLowest: dark ? const Color(0xFF101418) : const Color(0xFFffffff),
    onSurfaceVariant: dark ? const Color(0xFF8a9097) : const Color(0xFF5e646c),
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);

  return base.copyWith(
    extensions: [colors],
    scaffoldBackgroundColor: dark ? const Color(0xFF101418) : const Color(0xFFeff2f6),
    textTheme: base.textTheme.apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    ),
    cardTheme: CardThemeData(
      color: dark ? const Color(0xFF191d22) : const Color(0xFFFFFFFF),
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant, thickness: 1),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: scheme.surface.withValues(alpha: 0.7),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: colors.chart1,
        foregroundColor: scheme.onPrimary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: scheme.onSurface,
        side: BorderSide(color: scheme.outline),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: colors.chart1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: scheme.surfaceContainerHighest,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      side: BorderSide.none,
    ),
    tabBarTheme: TabBarThemeData(
      indicatorColor: colors.chart1,
      labelColor: colors.chart1,
      unselectedLabelColor: scheme.onSurfaceVariant,
      labelStyle: const TextStyle(fontWeight: FontWeight.w600),
      dividerColor: Colors.transparent,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      backgroundColor: dark ? const Color(0xFF2e3339) : const Color(0xFF171b20),
      contentTextStyle: TextStyle(color: dark ? const Color(0xFFe5e8ec) : const Color(0xFFf8fafd)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: colors.chart1,
      linearTrackColor: scheme.surfaceContainerHighest,
    ),
  );
}
