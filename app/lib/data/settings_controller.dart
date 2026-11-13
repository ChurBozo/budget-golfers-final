import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Small preferences, kept in shared_preferences. The `theme_mode` and
/// `units` keys are the same as the old app's, so they carry over when this
/// version is installed over it.
class SettingsController extends ChangeNotifier {
  static const _themeKey = 'theme_mode';
  static const _unitsKey = 'units';
  static const _clubKey = 'current_club_code';

  String _theme = 'light'; // light | dark | system
  String _units = 'metric'; // metric | imperial
  String? _currentClub;

  String get theme => _theme;
  String get units => _units;
  bool get metric => _units != 'imperial';
  String? get currentClub => _currentClub;

  ThemeMode get themeMode {
    switch (_theme) {
      case 'dark':
        return ThemeMode.dark;
      case 'system':
        return ThemeMode.system;
      default:
        return ThemeMode.light;
    }
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final t = prefs.getString(_themeKey);
    // The old app also had "medium"; treat it as dark.
    _theme = (t == 'dark' || t == 'medium')
        ? 'dark'
        : (t == 'system' ? 'system' : 'light');
    _units = prefs.getString(_unitsKey) == 'imperial' ? 'imperial' : 'metric';
    _currentClub = prefs.getString(_clubKey);
  }

  Future<void> setTheme(String value) async {
    _theme = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, value);
  }

  Future<void> setUnits(String value) async {
    _units = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_unitsKey, value);
  }

  Future<void> setCurrentClub(String? code) async {
    _currentClub = code;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    if (code == null) {
      await prefs.remove(_clubKey);
    } else {
      await prefs.setString(_clubKey, code);
    }
  }
}
