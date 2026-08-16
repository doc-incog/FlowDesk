import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Thin helper over SharedPreferences for JSON list persistence,
/// seeded on first access — mirrors the web app's useLocalStorage hook.
class PersistedStore {
  PersistedStore(this._prefs);

  final SharedPreferences _prefs;

  List<T> load<T>(
    String key,
    List<T> seed,
    Map<String, dynamic> Function(T) toJson,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final raw = _prefs.getString(key);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw) as List<dynamic>;
        return decoded
            .map((e) => fromJson(e as Map<String, dynamic>))
            .toList();
      } catch (_) {
        // corrupted — fall through to seed
      }
    }
    save(key, seed, toJson);
    return List.of(seed);
  }

  void save<T>(String key, List<T> items, Map<String, dynamic> Function(T) toJson) {
    _prefs.setString(key, jsonEncode(items.map(toJson).toList()));
  }

  String? getString(String key) => _prefs.getString(key);

  void setString(String key, String value) => _prefs.setString(key, value);

  void remove(String key) => _prefs.remove(key);
}
