import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart' as geo;

import '../models/geo.dart';

enum LocationState { ready, serviceOff, denied, deniedForever }

/// GPS helpers around geolocator.
class LocationService {
  LocationService._();

  /// Asks for location permission if needed (the first tee is the natural
  /// moment) and reports whether GPS can be used.
  static Future<LocationState> ensureReady() async {
    try {
      if (!await geo.Geolocator.isLocationServiceEnabled()) {
        return LocationState.serviceOff;
      }
      var perm = await geo.Geolocator.checkPermission();
      if (perm == geo.LocationPermission.denied) {
        perm = await geo.Geolocator.requestPermission();
      }
      if (perm == geo.LocationPermission.deniedForever) {
        return LocationState.deniedForever;
      }
      if (perm == geo.LocationPermission.denied) return LocationState.denied;
      return LocationState.ready;
    } catch (_) {
      return LocationState.denied;
    }
  }

  /// One fix, or the last known position if a fresh one takes too long.
  static Future<LatLng?> current() async {
    if (await ensureReady() != LocationState.ready) return null;
    try {
      final p = await geo.Geolocator.getCurrentPosition(
        locationSettings: const geo.LocationSettings(
          accuracy: geo.LocationAccuracy.best,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return LatLng(p.latitude, p.longitude);
    } catch (_) {
      try {
        final last = await geo.Geolocator.getLastKnownPosition();
        if (last != null) return LatLng(last.latitude, last.longitude);
      } catch (_) {}
      return null;
    }
  }

  /// A continuous feed of fixes while a round is being scored.
  static Stream<geo.Position> stream() => geo.Geolocator.getPositionStream(
        locationSettings: const geo.LocationSettings(
          accuracy: geo.LocationAccuracy.best,
          distanceFilter: 0,
        ),
      );

  /// Phone GPS wanders by a few metres, so a shot's start is the average of
  /// the last few fixes, weighted towards the more accurate ones. Only fixes
  /// from the last [maxAge] are used.
  static LatLng? average(
    List<geo.Position> fixes, {
    Duration maxAge = const Duration(seconds: 15),
    int samples = 3,
  }) {
    final now = DateTime.now();
    final fresh = fixes
        .where((p) => now.difference(p.timestamp).abs() <= maxAge)
        .toList();
    if (fresh.isEmpty) return null;
    final use = fresh.length > samples ? fresh.sublist(fresh.length - samples) : fresh;
    var wSum = 0.0, lat = 0.0, lng = 0.0;
    for (final p in use) {
      final w = 1.0 / math.max(p.accuracy, 1.0);
      wSum += w;
      lat += p.latitude * w;
      lng += p.longitude * w;
    }
    return LatLng(lat / wSum, lng / wSum);
  }
}
