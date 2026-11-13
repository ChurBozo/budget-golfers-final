import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:golfapp/models/geo.dart';
import 'package:golfapp/models/hole.dart';
import 'package:golfapp/models/round.dart';
import 'package:golfapp/models/shot.dart';

Shot _shot(String id, String club, LatLng? start, {String? result}) =>
    Shot(id: id, ts: DateTime(2026, 9, 12, 14, 10), club: club, start: start, result: result);

/// Plays hole 1 of the Assignment 2 sample: driver to the fairway, 8 iron to
/// the green, two putts = par 4.
HoleScore _sampleHole1() {
  final hole = HoleScore(number: 1, par: 4, distanceMetres: 352);
  hole.addShot(_shot('s1', 'driver', const LatLng(-37.67412, 176.22401), result: ShotResult.fairway));
  hole.addShot(_shot('s2', '8i', const LatLng(-37.67601, 176.22455)));
  hole.addPutt();
  hole.addPutt();
  return hole;
}

void main() {
  late Map<String, dynamic> fixture;

  setUpAll(() {
    final file = File('test/fixtures/rounds_create_request.json');
    fixture = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  });

  group('HoleScore', () {
    test('strokes are shots + putts + penalties', () {
      final h = _sampleHole1();
      expect(h.shots.length, 2);
      expect(h.putts, 2);
      expect(h.strokes, 4);
      expect(h.toPar, 0);
    });

    test('a new shot sets the landing point of the shot before it', () {
      final h = _sampleHole1();
      expect(h.shots.first.end, const LatLng(-37.67601, 176.22455));
      expect(h.shots.first.distanceM, closeTo(215.47, 0.05));
    });

    test('putting tags the last full shot as finishing on the green', () {
      final h = _sampleHole1();
      expect(h.shots.last.result, ShotResult.green);
    });

    test('fairway and green in regulation are worked out', () {
      final h = _sampleHole1();
      expect(h.teeClub, 'driver');
      expect(h.fairwayHit, isTrue);
      expect(h.greenInRegulation, isTrue); // 2 strokes to the green on a par 4
    });

    test('par 3s have no fairway', () {
      final h = HoleScore(number: 2, par: 3)..addShot(_shot('x', '7i', null, result: ShotResult.fairway));
      expect(h.fairwayPossible, isFalse);
      expect(h.fairwayHit, isNull);
    });

    test('Undo reverses presses in order', () {
      final h = _sampleHole1()..addPenalty();
      expect(h.strokes, 5);
      h.undo();
      expect(h.penalties, 0);
      h.undo();
      expect(h.putts, 1);
      h.undo();
      h.undo();
      h.undo();
      expect(h.strokes, 0);
      expect(h.undo(), isFalse);
    });

    test('the golfer can override fairway and GIR', () {
      final h = _sampleHole1()
        ..fairwayHitOverride = false
        ..girOverride = false;
      expect(h.fairwayHit, isFalse);
      expect(h.greenInRegulation, isFalse);
    });
  });

  group('Round', () {
    Round sampleRound() {
      final r = Round.start(
        courseName: '  Omanu Golf Club ',
        tee: 'Yellow',
        holesPlayed: 9,
        startHole: 10,
        coursePars: [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4],
        playedAt: DateTime.utc(2026, 9, 12, 2, 10),
      );
      for (final h in r.holes) {
        for (var i = 0; i < h.par; i++) {
          h.addPutt(); // par on every hole, all putts keeps it simple
        }
      }
      return r;
    }

    test('a back-nine round numbers its holes 10 to 18 with that nine\'s pars', () {
      final r = sampleRound();
      expect(r.holes.first.number, 10);
      expect(r.holes.last.number, 18);
      expect(r.holes.first.par, 4);
      expect(r.parTotal, 36);
      expect(r.courseName, 'Omanu Golf Club');
    });

    test('totals', () {
      final t = sampleRound().totals;
      expect(t.strokes, 36);
      expect(t.toPar, 0);
      expect(t.holesScored, 9);
    });

    test('unscored holes block finishing', () {
      final r = Round.start(courseName: 'Te Puke', holesPlayed: 18, coursePars: List.filled(18, 4));
      expect(r.isComplete, isFalse);
      expect(r.unscoredHoles.length, 18);
      expect(r.clientRoundId, matches(RegExp(r'^[0-9a-f-]{36}$')));
    });

    test('local JSON round-trips', () {
      final r = sampleRound();
      r.holes.first.addShot(_shot('s', '7i', const LatLng(-37.7, 176.2)));
      final copy = Round.fromJson(jsonDecode(jsonEncode(r.toJson())) as Map<String, dynamic>);
      expect(copy.clientRoundId, r.clientRoundId);
      expect(copy.holes.length, 9);
      expect(copy.holes.first.shots.single.club, '7i');
      expect(copy.totals.strokes, r.totals.strokes);
    });
  });

  group('upload body matches Assignment 2 rounds_create_request.json', () {
    test('top-level keys, with course name in place of courseId', () {
      final r = Round.start(
        courseName: 'Omanu Golf Club',
        tee: 'Yellow',
        holesPlayed: 18,
        coursePars: List.filled(18, 4),
        playedAt: DateTime.utc(2026, 9, 12, 2, 10),
      );
      r.holes[0] = _sampleHole1();
      for (final h in r.holes.skip(1)) {
        h.addShot(_shot('t${h.number}', 'driver', null));
        h.addPutt();
        h.addPutt();
        h.addPutt();
      }
      final body = r.toApiJson();

      final expectedKeys = fixture.keys.toSet()
        ..remove('courseId')
        ..add('course');
      expect(body.keys.toSet(), expectedKeys);
      expect(body['course'], {'name': 'Omanu Golf Club'});
      expect(body['source'], fixture['source']);
      expect(body['tee'], 'Yellow');
      expect(body['playedAt'], fixture['playedAt']); // 2026-09-12T02:10:00.000Z
      expect((body['holes'] as List).length, 18);
    });

    test('hole 1 matches the sample hole field for field', () {
      final sample = Map<String, dynamic>.from((fixture['holes'] as List).first as Map);
      final hole = _sampleHole1().toApiJson();
      for (final key in sample.keys) {
        expect(hole[key], sample[key], reason: 'holes[0].$key');
      }
    });

    test('shots carry seq, club, start/end as lat/lng, distance and result', () {
      final shots = _sampleHole1().toApiJson()['shots'] as List;
      final first = shots.first as Map<String, dynamic>;
      expect(first['seq'], 1);
      expect(first['club'], 'driver');
      expect(first['start'], {'lat': -37.67412, 'lng': 176.22401});
      expect(first['end'], {'lat': -37.67601, 'lng': 176.22455});
      expect(first['distanceMetres'], 215);
      expect(first['result'], 'fairway');
      expect(first.containsKey('target'), isFalse, reason: 'the API design has no target field');
    });

    test('API validation rules hold: strokes 1–20 and putts ≤ strokes', () {
      final h = _sampleHole1().toApiJson();
      expect(h['strokes'], inInclusiveRange(1, 20));
      expect(h['putts'] as int, lessThanOrEqualTo(h['strokes'] as int));
    });
  });
}
