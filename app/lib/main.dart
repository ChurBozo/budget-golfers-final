import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import 'app.dart';
import 'config.dart';
import 'data/app_database.dart';
import 'data/settings_controller.dart';
import 'services.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Public token only (pk.…), from --dart-define-from-file=config/mapbox.json.
  if (AppConfig.hasMapboxToken) {
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
  }

  await AppDatabase.instance.open();

  final settings = SettingsController();
  await settings.load();

  // Sign-in is optional: it is only needed to upload rounds.
  await Services.init();

  runApp(BudgetGolfersApp(settings: settings));

  Services.startAutoUpload();
}
