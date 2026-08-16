import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'repositories.dart';

const _themeKey = 'flowdesk.theme';

class ThemeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    final raw = ref.watch(persistedStoreProvider).getString(_themeKey);
    return switch (raw) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  void setMode(ThemeMode mode) {
    ref.read(persistedStoreProvider).setString(
          _themeKey,
          switch (mode) {
            ThemeMode.light => 'light',
            ThemeMode.dark => 'dark',
            ThemeMode.system => 'system',
          },
        );
    state = mode;
  }
}

final themeProvider = NotifierProvider<ThemeController, ThemeMode>(ThemeController.new);
