import 'dart:math' as math;

/// A GPS position in decimal degrees.
///
/// The app and the upload body use `{ "lat": .., "lng": .. }`. The API turns
/// this into GeoJSON (`[lng, lat]`) before storing it, so the app never sends
/// GeoJSON itself. Mapbox `Position` also takes `(lng, lat)`: convert only in
/// [LatLng.fromLngLat] and in the map screen.
class LatLng {
  final double lat;
  final double lng;

  const LatLng(this.lat, this.lng);

  /// Builds a [LatLng] from values in Mapbox / GeoJSON order (lng first).
  factory LatLng.fromLngLat(num lng, num lat) =>
      LatLng(lat.toDouble(), lng.toDouble());

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};

  static LatLng? fromJson(Object? value) {
    if (value is! Map) return null;
    final lat = value['lat'];
    final lng = value['lng'];
    if (lat is num && lng is num) return LatLng(lat.toDouble(), lng.toDouble());
    return null;
  }

  @override
  bool operator ==(Object other) =>
      other is LatLng && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);

  @override
  String toString() => 'LatLng($lat, $lng)';
}

/// Distance and shot-shape maths, ported from the old `ShotEvent` helpers.
class Geo {
  Geo._();

  static const double earthRadiusM = 6371000.0;

  static double _rad(double deg) => deg * math.pi / 180.0;

  /// Great-circle distance in metres (haversine).
  static double distanceM(LatLng a, LatLng b) {
    final dLat = _rad(b.lat - a.lat);
    final dLng = _rad(b.lng - a.lng);
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(a.lat)) *
            math.cos(_rad(b.lat)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return earthRadiusM * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
  }

  /// Projects [p] onto a flat east/north plane centred on [origin], in metres.
  /// Accurate enough for the few hundred metres of a golf shot.
  static List<double> _enu(LatLng origin, LatLng p) {
    final cosLat = math.cos(_rad(origin.lat));
    final x = _rad(p.lng - origin.lng) * earthRadiusM * cosLat; // east
    final y = _rad(p.lat - origin.lat) * earthRadiusM; // north
    return [x, y];
  }

  /// Signed angle between the start→target line and the start→landing line.
  /// Positive means the ball finished RIGHT of the target line, negative LEFT.
  /// Returns null when either line is shorter than half a metre.
  static double? biasDeg(LatLng start, LatLng target, LatLng landed) {
    final t = _enu(start, target);
    final a = _enu(start, landed);
    final magT = math.sqrt(t[0] * t[0] + t[1] * t[1]);
    final magA = math.sqrt(a[0] * a[0] + a[1] * a[1]);
    if (magT < 0.5 || magA < 0.5) return null;
    final dot = t[0] * a[0] + t[1] * a[1];
    final cross = t[0] * a[1] - t[1] * a[0]; // positive = anticlockwise = left
    final deg = math.atan2(cross, dot) * 180.0 / math.pi;
    return -deg; // flip so that right is positive
  }

  /// Sideways miss in metres from the start→target line (right positive).
  static double? lateralMissM(LatLng start, LatLng target, LatLng landed) {
    final t = _enu(start, target);
    final a = _enu(start, landed);
    final magT = math.sqrt(t[0] * t[0] + t[1] * t[1]);
    if (magT < 0.5) return null;
    final cross = t[0] * a[1] - t[1] * a[0];
    return -cross / magT;
  }

  /// Long (+) or short (−) of the target along the target line, in metres.
  static double? forwardMissM(LatLng start, LatLng target, LatLng landed) {
    final t = _enu(start, target);
    final a = _enu(start, landed);
    final magT = math.sqrt(t[0] * t[0] + t[1] * t[1]);
    if (magT < 0.5) return null;
    final along = (a[0] * t[0] + a[1] * t[1]) / magT;
    return along - magT;
  }
}
