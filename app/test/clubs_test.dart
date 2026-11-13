import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:golfapp/models/club_stats.dart';
import 'package:golfapp/models/clubs.dart';
import 'package:golfapp/models/geo.dart';
import 'package:golfapp/models/round.dart';
import 'package:golfapp/models/shot.dart';

void main() {
  group('Clubs.canonicalise (ported from the old _canon)', () {
    final cases = {
      'Driver': 'driver',
      'D': 'driver',
      '3W': '3w',
      '5 wood': '5w',
      '3H': '3h',
      'Hybrid 4': '4h',
      '7I': '7i',
      '7 Iron': '7i',
      'Iron 6': '6i',
      'PW': 'pw',
      'Gap wedge': 'gw',
      'AW': 'gw',
      'Sand Wedge': 'sw',
      'LW': 'lw',
      'Putter': 'putter',
      'putter': 'putter',
    };
    cases.forEach((raw, code) {
      test('"$raw" → $code', () => expect(Clubs.canonicalise(raw), code));
    });

    test('unknown names give null', () {
      expect(Clubs.canonicalise('Banana'), isNull);
      expect(Clubs.canonicalise(''), isNull);
      expect(Clubs.canonicalise(null), isNull);
    });

    test('every code in clubs_put_request.json is known', () {
      final json = jsonDecode(File('test/fixtures/clubs_put_request.json').readAsStringSync());
      for (final c in (json['clubs'] as List)) {
        expect(Clubs.byCode(c['code'] as String), isNotNull, reason: c['code'] as String);
      }
    });

    test('the default bag has 14 clubs', () {
      expect(Clubs.defaultBag.length, Clubs.maxInBag);
    });
  });

  group('ClubStats.suggest (ported from _suggestClubByAvgs)', () {
    const distances = {'7i': 140.0, '6i': 152.0, '5i': 165.0, 'driver': 212.0, 'pw': 105.0};

    test('the shortest club that still reaches', () {
      expect(ClubStats.suggest(150, distances), '6i');
      expect(ClubStats.suggest(140, distances), '7i');
      expect(ClubStats.suggest(100, distances), 'pw');
    });

    test('beyond every club, the longest', () {
      expect(ClubStats.suggest(260, distances), 'driver');
    });

    test('on the green, the putter', () {
      expect(ClubStats.suggest(8, distances), 'putter');
    });

    test('with no distances yet, rough amateur ranges', () {
      expect(ClubStats.suggest(120, const {}), '8i');
      expect(ClubStats.suggest(240, const {}), 'driver');
    });
  });

  group('ClubStats.compute', () {
    Round roundWith7iShots(int count) {
      final r = Round.start(courseName: 'Test', holesPlayed: 9, coursePars: List.filled(18, 4));
      for (var i = 0; i < count; i++) {
        final start = LatLng(-37.7 + i * 0.01, 176.2);
        // 140 m north of the start: 140 / 111194.9 degrees of latitude.
        final end = LatLng(start.lat + 140 / 111194.9266, 176.2);
        r.holes[i % 9].shots.add(Shot(id: '$i', ts: DateTime(2026), club: '7i', start: start, end: end));
      }
      return r;
    }

    test('needs 5 measured shots before a distance counts (API rule)', () {
      final four = ClubStats.compute([roundWith7iShots(4)])['7i']!;
      expect(four.measuredShots, 4);
      expect(four.enoughData, isFalse);
      expect(four.avgDistM, isNull);

      final five = ClubStats.compute([roundWith7iShots(5)])['7i']!;
      expect(five.enoughData, isTrue);
      expect(five.avgDistM, closeTo(140, 0.5));
      expect(five.longestM, closeTo(140, 0.5));
    });

    test('typed-in distances fill in until there is enough data', () {
      final summaries = ClubStats.compute([roundWith7iShots(2)]);
      final bag = [
        const BagClub(code: '7i', inBag: true, manualMetres: 135),
        const BagClub(code: 'pw', inBag: true),
        const BagClub(code: '4i', inBag: false, manualMetres: 170),
      ];
      expect(ClubStats.distancesFor(summaries, bag), {'7i': 135.0});
    });
  });
}
