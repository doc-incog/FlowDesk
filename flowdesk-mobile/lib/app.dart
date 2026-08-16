import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'providers/router.dart';
import 'providers/theme_controller.dart';

class FlowDeskApp extends ConsumerWidget {
  const FlowDeskApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeProvider);
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'FlowDesk — Unified Campus Platform',
      theme: buildFlowDeskTheme(Brightness.light),
      darkTheme: buildFlowDeskTheme(Brightness.dark),
      themeMode: mode,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
