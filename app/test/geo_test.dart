import 'package:flutter_test/flutter_test.dart';
import 'package:golfapp/models/geo.dart';
import 'package:golfapp/models/shot.dart';

void main() {
  group('Geo.distanceM (haversine, ported from the old ShotEvent)', () {
    test('the Assignment 2 sample drive is about 215 m', () {
      const start = LatLng(-37.67412, 176.22401);
      const end = LatLng(-37.67601, 176.22455);
      expect(Geo.distanceM(start, end), closeTo(215.47, 0.05));
    });

    test('0.001 degrees of latitude is about 111 m', () {
      expect(Geo.distanceM(const LatLng(0, 0), const LatLng(0.001, 0)), closeTo(111.19, 0.05));
    });

    test('distance to itself is zero', () {
      const p = LatLng(-37.7, 176.2);
      expect(Geo.distanceM(p, p), 0);
    });
  });

  group('bias and misses (right positive, left negative)', () {
    // Aim due north 150 m from the start.
    const start = LatLng(-37.70000, 176.20000);
    const target = LatLng(-37.69865, 176.20000);

    test('a ball finishing east of a northward line is a miss to the right', () {
      const landed = LatLng(-37.69870, 176.20020);
      expect(Geo.biasDeg(start, target, landed), greaterThan(0));
      expect(Geo.lateralMissM(start, target, landed), greaterThan(10));
    });

    test('a ball finishing west of the line is a miss to the left', () {
      const landed = LatLng(-37.69870, 176.19980);
      expect(Geo.biasDeg(start, target, landed), lessThan(0));
      expect(Geo.lateralMissM(start, target, landed), lessThan(-10));
    });

    test('short of the target is a negative forward miss', () {
      const landed = LatLng(-37.69900, 176.20000);
      expect(Geo.forwardMissM(start, target, landed), lessThan(0));
    });

    test('a ball on the target is 100% accurate', () {
      final shot = Shot(id: 'a', ts: DateTime(2026), start: start, target: target, end: target);
      expect(shot.accuracyPct, closeTo(100, 0.001));
    });
  });

  group('LatLng', () {
    test('Mapbox / GeoJSON order is lng first', () {
      final p = LatLng.fromLngLat(176.22401, -37.67412);
      expect(p.lat, -37.67412);
      expect(p.lng, 176.22401);
    });

    test('round-trips through the upload JSON shape', () {
      const p = LatLng(-37.67412, 176.22401);
      expect(p.toJson(), {'lat': -37.67412, 'lng': 176.22401});
      expect(LatLng.fromJson(p.toJson()), p);
      expect(LatLng.fromJson(null), isNull);
    });
  });
}
