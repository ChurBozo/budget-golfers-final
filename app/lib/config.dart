/// Build-time settings, passed with `--dart-define-from-file=config/mapbox.json`.
///
/// Only the public Mapbox token (`pk.…`) is needed. Since mapbox_maps_flutter
/// 2.5.1 there is no secret downloads token, so none belongs in this project.
class AppConfig {
  AppConfig._();

  static const String mapboxAccessToken =
      String.fromEnvironment('MAPBOX_ACCESS_TOKEN');

  static bool get hasMapboxToken => mapboxAccessToken.startsWith('pk.');

  /// The Budget Golfers API. 10.0.2.2 is the Android emulator's name for the
  /// computer it runs on, so a local API on port 3000 works with no setup.
  /// Set API_BASE_URL in config/mapbox.json for a phone or the hosted API;
  /// it can also be changed in Settings > Account.
  static const String defaultApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
}
