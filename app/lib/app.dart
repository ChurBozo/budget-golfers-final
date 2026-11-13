import 'package:flutter/material.dart';

import 'data/settings_controller.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

/// Makes the [SettingsController] available to every screen.
class AppScope extends InheritedNotifier<SettingsController> {
  const AppScope({
    super.key,
    required SettingsController settings,
    required super.child,
  }) : super(notifier: settings);

  /// Use in `build` methods: rebuilds when a setting changes.
  static SettingsController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope above this widget.');
    return scope!.notifier!;
  }

  /// Use in callbacks: reads without listening.
  static SettingsController read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope above this widget.');
    return scope!.notifier!;
  }
}

class BudgetGolfersApp extends StatelessWidget {
  final SettingsController settings;

  const BudgetGolfersApp({super.key, required this.settings});

  @override
  Widget build(BuildContext context) {
    return AppScope(
      settings: settings,
      child: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => MaterialApp(
          title: 'Budget Golfers',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: settings.themeMode,
          home: const HomeScreen(),
        ),
      ),
    );
  }
}
