// "Download my rounds", against a fake Budget Golfers API (package:http's
// MockClient). No plugins or database are needed.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:golfapp/data/account_controller.dart';
import 'package:golfapp/data/download_service.dart';
import 'package:golfapp/models/round.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const userId = '66f0a1c2e4b0a1b2c3d4e5f6';

/// Rounds kept in a list instead of SQLite.
class FakeRoundLibrary implements RoundLibrary {
  final List<Round> rounds = [];

  @override
  Future<List<Round>> finishedRounds() async => rounds.where((r) => r.finished).toList();

  @override
  Future<Round?> byId(String clientRoundId) async {
    for (final r in rounds) {
      if (r.clientRoundId == clientRoundId) return r;
    }
    return null;
  }

  @override
  Future<void> save(Round round) async {
    rounds.removeWhere((r) => r.clientRoundId == round.clientRoundId);
    rounds.add(round);
  }
}

http.Response json(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

/// A round in the API's detail shape: hole 1 has GPS shots, hole 2 was scored
/// without GPS, so it has no shot list.
Map<String, dynamic> apiRound({
  String id = '66f2c9e0b1a2c3d4e5f60718',
  String? clientRoundId = 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10',
  int holesPlayed = 18,
  int firstHole = 1,
}) =>
    {
      'id': id,
      'clientRoundId': clientRoundId,
      'source': 'mobile-app',
      'playedAt': '2026-09-12T02:10:00.000Z',
      'syncedAt': '2026-09-12T04:41:00.000Z',
      'course': {'id': '66e9b7d1a2c3d4e5f6a7b8c9', 'name': 'Omanu Golf Club', 'par': 72},
      'tee': 'Yellow',
      'holesPlayed': holesPlayed,
      'holes': [
        {
          'number': firstHole,
          'par': 4,
          'distanceMetres': 352,
          'strokes': 5,
          'putts': 2,
          'penalties': 0,
          'teeClub': 'driver',
          'fairwayHit': false,
          'greenInRegulation': false,
          'shots': [
            {
              'seq': 2,
              'club': '7i',
              'start': {'lat': -37.67595, 'lng': 176.22498},
              'end': {'lat': -37.6769, 'lng': 176.2253},
              'distanceMetres': 112,
              'result': 'bunker',
            },
            {
              'seq': 1,
              'club': 'driver',
              'start': {'lat': -37.67412, 'lng': 176.22401},
              'end': {'lat': -37.67595, 'lng': 176.22498},
              'distanceMetres': 219,
              'result': 'rough-left',
            },
          ],
        },
        {
          'number': firstHole + 1,
          'par': 3,
          'strokes': 4,
          'putts': 2,
          'penalties': 1,
          'teeClub': '6i',
          'greenInRegulation': false,
        },
      ],
      'notes': 'Windy back nine',
    };

Future<(AccountController, DownloadService, FakeRoundLibrary, List<http.Request>)> makeServices(
  http.Response Function() exportReply, {
  List<String> known = const [],
}) async {
  final requests = <http.Request>[];
  final client = MockClient((request) async {
    requests.add(request);
    if (request.url.path == '/api/auth/login') {
      return json(200, {
        'success': true,
        'data': {
          'token': 'token-1',
          'expiresIn': 2592000,
          'user': {'id': userId, 'email': 'aroha.m@example.com', 'displayName': 'Aroha M.'},
        },
      });
    }
    if (request.url.path == '/api/users/$userId/export') return exportReply();
    return json(404, {
      'success': false,
      'error': {'status': 404, 'code': 'NOT_FOUND', 'message': 'Not found', 'requestId': 'req_1'},
    });
  });
  final account = AccountController(store: MemoryKeyValueStore(), httpClient: client);
  await account.load();
  await account.setBaseUrl('http://api.test/');
  await account.signIn(email: 'aroha.m@example.com', password: 'Correct-Horse-7');
  final library = FakeRoundLibrary();
  final remembered = <String>[...known];
  final downloads = DownloadService(
    account: account,
    rounds: library,
    knownCourses: () async => remembered,
    rememberCourse: (name, pars) async => remembered.add(name),
  );
  return (account, downloads, library, requests);
}

void main() {
  group('roundFromApi', () {
    test('keeps every hole\'s score, the GPS shots and the uploaded status', () {
      final r = DownloadService.roundFromApi(apiRound(), ownerUserId: userId)!;

      expect(r.clientRoundId, 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10');
      expect(r.serverRoundId, '66f2c9e0b1a2c3d4e5f60718');
      expect(r.syncStatus, SyncStatus.synced);
      expect(r.finished, isTrue);
      expect(r.ownerUserId, userId);
      expect(r.courseName, 'Omanu Golf Club');
      expect(r.notes, 'Windy back nine');
      expect(r.holes, hasLength(18));

      final h1 = r.holes[0];
      expect(h1.strokes, 5);
      expect(h1.shots.map((s) => s.club), ['driver', '7i', null], reason: 'shots in seq order, plus one plain shot');
      expect(h1.shots.first.start?.lat, -37.67412);
      expect(h1.fairwayHit, isFalse);

      final h2 = r.holes[1];
      expect(h2.strokes, 4, reason: 'one plain shot, two putts and a penalty');
      expect(h2.shots.single.club, '6i');
      expect(h2.shots.single.start, isNull);

      expect(r.holes[2].played, isFalse, reason: 'holes the server did not send stay unscored');
    });

    test('a back-nine round starts at hole 10', () {
      final r = DownloadService.roundFromApi(apiRound(holesPlayed: 9, firstHole: 10), ownerUserId: userId)!;
      expect(r.holesPlayed, 9);
      expect(r.startHole, 10);
      expect(r.holes.map((h) => h.number), [10, 11, 12, 13, 14, 15, 16, 17, 18]);
    });

    test('a round entered on the website gets an id the API accepts', () {
      final r = DownloadService.roundFromApi(apiRound(clientRoundId: null), ownerUserId: userId)!;
      expect(r.clientRoundId, 'server-66f2c9e0b1a2c3d4e5f60718');
      expect(RegExp(r'^[A-Za-z0-9_-]{8,64}$').hasMatch(r.clientRoundId), isTrue);
    });

    test('a round without holes is skipped', () {
      final m = apiRound()..['holes'] = <Object>[];
      expect(DownloadService.roundFromApi(m, ownerUserId: userId), isNull);
    });
  });

  group('downloadMine', () {
    test('adds new rounds once, skips rounds already on the phone, and remembers the course', () async {
      final reply = json(200, {
        'success': true,
        'data': {
          'rounds': [
            apiRound(),
            apiRound(id: '66ea41b7b1a2c3d4e5f60611', clientRoundId: null),
          ],
        },
      });
      final (_, downloads, library, requests) = await makeServices(() => reply);

      final first = await downloads.downloadMine();
      expect(first.outcome, DownloadOutcome.done);
      expect(first.added, 2);
      expect(library.rounds, hasLength(2));
      expect(requests.last.url.query, 'format=json');
      expect(requests.last.headers['Authorization'], 'Bearer token-1');

      final second = await downloads.downloadMine();
      expect(second.added, 0);
      expect(second.alreadyHere, 2);
      expect(second.summary, 'Every round on your account is already on this phone.');
      expect(library.rounds, hasLength(2));
    });

    test('an expired sign-in asks the golfer to sign in again', () async {
      final (account, downloads, library, _) = await makeServices(() => json(401, {
            'success': false,
            'error': {'status': 401, 'code': 'TOKEN_EXPIRED', 'message': 'Expired', 'requestId': 'req_2'},
          }));

      final report = await downloads.downloadMine();
      expect(report.outcome, DownloadOutcome.needsSignIn);
      expect(account.signedIn, isFalse);
      expect(library.rounds, isEmpty);
    });
  });
}
