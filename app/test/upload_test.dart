// Sign-in and the upload queue, against a fake Budget Golfers API
// (package:http's MockClient). No plugins or database are needed.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:golfapp/data/account_controller.dart';
import 'package:golfapp/data/api_client.dart';
import 'package:golfapp/data/round_repository.dart';
import 'package:golfapp/data/upload_service.dart';
import 'package:golfapp/models/clubs.dart';
import 'package:golfapp/models/round.dart';
import 'package:golfapp/models/shot.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Rounds kept in a list instead of SQLite.
class FakeRoundStore implements RoundStore {
  final List<Round> rounds;
  FakeRoundStore(this.rounds);

  @override
  Future<List<Round>> pendingUploads() async =>
      rounds.where((r) => r.finished && r.syncStatus == SyncStatus.pending).toList();

  @override
  Future<List<Round>> failedUploads() async =>
      rounds.where((r) => r.finished && r.syncStatus == SyncStatus.failed).toList();

  @override
  Future<void> save(Round round) async {
    final i = rounds.indexWhere((r) => r.clientRoundId == round.clientRoundId);
    if (i >= 0) rounds[i] = round;
  }
}

/// A finished round with a par on every hole (two shots, two putts).
Round finishedRound({int holes = 18, int startHole = 1}) {
  final r = Round.start(
    courseName: 'Omanu Golf Club',
    holesPlayed: holes,
    startHole: startHole,
    coursePars: List.filled(18, 4),
  );
  for (final h in r.holes) {
    h.addShot(Shot(id: '${h.number}a', ts: DateTime(2026), club: 'driver'));
    h.addShot(Shot(id: '${h.number}b', ts: DateTime(2026), club: '7i'));
    h.addPutt();
    h.addPutt();
  }
  r.finished = true;
  return r;
}

http.Response json(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

Map<String, dynamic> loginData({int expiresIn = 2592000}) => {
      'success': true,
      'data': {
        'token': 'token-1',
        'expiresIn': expiresIn,
        'user': {
          'id': '66f0a1c2e4b0a1b2c3d4e5f6',
          'email': 'aroha.m@example.com',
          'displayName': 'Aroha M.',
          'preferences': {'units': 'metric', 'theme': 'light', 'showOnLeaderboard': true},
        },
      },
    };

Map<String, dynamic> created(String id, {bool duplicate = false}) => {
      'success': true,
      'data': {
        'id': id,
        'clientRoundId': 'x',
        'totals': {'strokes': 72, 'toPar': 0, 'putts': 36},
        'duplicate': duplicate,
        'links': {'self': '/api/rounds/$id'},
      },
    };

Map<String, dynamic> apiError(int status, String code, String message, [List<Map<String, String>>? details]) => {
      'success': false,
      'error': {
        'status': status,
        'code': code,
        'message': message,
        if (details != null) 'details': details,
        'requestId': 'req_abc123',
      },
    };

/// A fake API: login and the bag always work; each POST /api/rounds takes
/// the next reply from [roundReplies].
class FakeApi {
  final List<http.Request> requests = [];
  final List<Object> roundReplies;
  FakeApi(this.roundReplies);

  late final MockClient client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path;
    if (path == '/api/auth/login' || path == '/api/auth/register') {
      return json(path.endsWith('register') ? 201 : 200, loginData());
    }
    if (path.startsWith('/api/clubs/')) return json(200, {'success': true, 'data': {}});
    if (path == '/api/rounds') {
      final next = roundReplies.removeAt(0);
      if (next is Exception) throw next;
      return next as http.Response;
    }
    return json(404, apiError(404, 'NOT_FOUND', 'There is no ${request.method} $path'));
  });

  List<http.Request> get roundPosts => requests.where((r) => r.url.path == '/api/rounds').toList();
}

Future<(AccountController, UploadService, FakeRoundStore)> makeServices(
  FakeApi api,
  List<Round> rounds, {
  bool signIn = true,
}) async {
  final account = AccountController(store: MemoryKeyValueStore(), httpClient: api.client);
  await account.load();
  await account.setBaseUrl('http://api.test/');
  if (signIn) await account.signIn(email: 'aroha.m@example.com', password: 'Correct-Horse-7');
  final store = FakeRoundStore(rounds);
  final uploads = UploadService(
    account: account,
    rounds: store,
    loadBag: () async => const [
      BagClub(code: 'driver', inBag: true),
      BagClub(code: '7i', inBag: true),
      BagClub(code: '4i', inBag: false),
    ],
  );
  return (account, uploads, store);
}

void main() {
  group('sign in', () {
    test('asks for the app token and sends the device', () async {
      final api = FakeApi([]);
      final (account, _, _) = await makeServices(api, []);
      final body = jsonDecode(api.requests.first.body) as Map<String, dynamic>;
      expect(api.requests.first.url.toString(), 'http://api.test/api/auth/login');
      expect(body['client'], 'mobile-app');
      expect(body['device']['deviceId'], startsWith('app-'));
      expect(account.signedIn, isTrue);
      expect(account.account!.displayName, 'Aroha M.');
    });

    test('a saved session is restored, and an expired one is not', () async {
      final store = MemoryKeyValueStore();
      final api = FakeApi([]);
      final first = AccountController(store: store, httpClient: api.client);
      await first.load();
      await first.signIn(email: 'aroha.m@example.com', password: 'x');

      final again = AccountController(store: store, httpClient: api.client);
      await again.load();
      expect(again.signedIn, isTrue);

      final old = Account.fromJson(jsonDecode(store.values['account']!) as Map<String, dynamic>);
      store.values['account'] = jsonEncode(Account(
        userId: old.userId,
        email: old.email,
        displayName: old.displayName,
        token: old.token,
        expiresAt: DateTime.now().subtract(const Duration(days: 1)),
      ).toJson());
      final expired = AccountController(store: store, httpClient: api.client);
      await expired.load();
      expect(expired.signedIn, isFalse);
      expect(expired.sessionExpired, isTrue);
      expect(expired.lastEmail, 'aroha.m@example.com');
    });

    test('a wrong password gives the API message', () async {
      final client = MockClient((_) async => json(401, apiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect.')));
      final account = AccountController(store: MemoryKeyValueStore(), httpClient: client);
      await account.load();
      await expectLater(
        account.signIn(email: 'a@b.co', password: 'nope'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Email or password is incorrect.')),
      );
      expect(account.signedIn, isFalse);
    });
  });

  group('upload queue', () {
    test('sends the bag first, then each round with the token and device id', () async {
      final api = FakeApi([json(201, created('r1')), json(200, created('r2', duplicate: true))]);
      final rounds = [finishedRound(), finishedRound(holes: 9)];
      final (_, uploads, store) = await makeServices(api, rounds);

      final report = await uploads.uploadPending();

      expect(report.outcome, UploadOutcome.done);
      expect(report.uploaded, 1);
      expect(report.duplicates, 1);
      expect(store.rounds.map((r) => r.syncStatus), everyElement(SyncStatus.synced));
      expect(store.rounds.map((r) => r.serverRoundId), ['r1', 'r2']);

      final paths = api.requests.map((r) => '${r.method} ${r.url.path}').toList();
      expect(paths, [
        'POST /api/auth/login',
        'PUT /api/clubs/66f0a1c2e4b0a1b2c3d4e5f6',
        'POST /api/rounds',
        'POST /api/rounds',
      ]);
      final post = api.roundPosts.first;
      expect(post.headers['Authorization'], 'Bearer token-1');
      expect(post.headers['X-Device-Id'], startsWith('app-'));
      final body = jsonDecode(post.body) as Map<String, dynamic>;
      expect(body['clientRoundId'], rounds.first.clientRoundId);
      expect(body['course'], {'name': 'Omanu Golf Club'});
      expect(body['source'], 'mobile-app');
      expect(body.containsKey('totals'), isFalse); // the server works out totals
      expect((body['holes'] as List).length, 18);
    });

    test('the bag is only sent once per sign-in', () async {
      final api = FakeApi([json(201, created('r1')), json(201, created('r2'))]);
      final rounds = [finishedRound()];
      final (_, uploads, store) = await makeServices(api, rounds);
      await uploads.uploadPending();
      store.rounds.add(finishedRound());
      await uploads.uploadPending();
      expect(api.requests.where((r) => r.method == 'PUT').length, 1);
    });

    test('a 422 marks the round failed with a readable reason and goes on to the next', () async {
      final api = FakeApi([
        json(422, apiError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
          {'field': 'holes[3].strokes', 'issue': 'must be between 1 and 20'},
        ])),
        json(201, created('r2')),
      ]);
      final backNine = finishedRound(holes: 9, startHole: 10);
      final (_, uploads, store) = await makeServices(api, [backNine, finishedRound()]);

      final report = await uploads.uploadPending();

      expect(report.outcome, UploadOutcome.done);
      expect(report.refused, 1);
      expect(report.uploaded, 1);
      expect(store.rounds[0].syncStatus, SyncStatus.failed);
      // holes[3] of a back-nine round is hole 13
      expect(store.rounds[0].syncError, 'Hole 13 strokes must be between 1 and 20');
      expect(store.rounds[1].syncStatus, SyncStatus.synced);
    });

    test('no connection or a busy server keeps the rounds queued and stops', () async {
      for (final reply in <Object>[
        json(503, apiError(503, 'SERVER_ERROR', 'Something went wrong on our side.')),
        json(429, apiError(429, 'RATE_LIMITED', 'Too many requests.')),
        http.ClientException('Connection refused'),
      ]) {
        final api = FakeApi([reply]);
        final (_, uploads, store) = await makeServices(api, [finishedRound(), finishedRound()]);
        final report = await uploads.uploadPending();
        expect(report.outcome, UploadOutcome.tryLater);
        expect(store.rounds.map((r) => r.syncStatus), everyElement(SyncStatus.pending));
        expect(api.roundPosts.length, 1, reason: 'stops after the first failure');
      }
    });

    test('a 401 signs out and asks for sign-in again', () async {
      final api = FakeApi([json(401, apiError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.'))]);
      final (account, uploads, store) = await makeServices(api, [finishedRound()]);

      final report = await uploads.uploadPending();

      expect(report.outcome, UploadOutcome.needsSignIn);
      expect(account.signedIn, isFalse);
      expect(account.sessionExpired, isTrue);
      expect(store.rounds.single.syncStatus, SyncStatus.pending);
    });

    test('signed out: nothing is sent', () async {
      final api = FakeApi([]);
      final (_, uploads, _) = await makeServices(api, [finishedRound()], signIn: false);
      final report = await uploads.uploadPending();
      expect(report.outcome, UploadOutcome.needsSignIn);
      expect(api.requests, isEmpty);
      await uploads.autoUpload(); // automatic triggers do nothing either
      expect(api.requests, isEmpty);
    });

    test('unfinished rounds are never uploaded', () async {
      final api = FakeApi([]);
      final playing = finishedRound()..finished = false;
      final (_, uploads, _) = await makeServices(api, [playing]);
      expect((await uploads.uploadPending()).outcome, UploadOutcome.nothingToDo);
      expect(api.roundPosts, isEmpty);
    });

    test("rounds kept for another account are not uploaded; unowned ones are claimed", () async {
      final api = FakeApi([json(201, created('r1'))]);
      final theirs = finishedRound()..ownerUserId = 'someone-else';
      final unowned = finishedRound();
      final (_, uploads, store) = await makeServices(api, [theirs, unowned]);

      final report = await uploads.uploadPending();

      expect(report.uploaded, 1);
      expect(api.roundPosts.length, 1);
      expect(store.rounds[0].syncStatus, SyncStatus.pending);
      expect(store.rounds[1].syncStatus, SyncStatus.synced);
      expect(store.rounds[1].ownerUserId, '66f0a1c2e4b0a1b2c3d4e5f6');
    });

    test('a different account signing in is noticed', () async {
      final store = MemoryKeyValueStore()..values['last_user_id'] = 'previous-golfer';
      final account = AccountController(store: store, httpClient: FakeApi([]).client);
      await account.load();
      await account.signIn(email: 'aroha.m@example.com', password: 'x');
      expect(account.previousUserId, 'previous-golfer');

      await account.signOut();
      await account.signIn(email: 'aroha.m@example.com', password: 'x');
      expect(account.previousUserId, isNull); // same account again
    });

    test('try again puts a failed round back in the queue', () async {
      final api = FakeApi([json(201, created('r9'))]);
      final failed = finishedRound()
        ..syncStatus = SyncStatus.failed
        ..syncError = 'Hole 1 strokes must be between 1 and 20';
      final (_, uploads, store) = await makeServices(api, [failed]);

      final report = await uploads.retry(failed);

      expect(report.uploaded, 1);
      expect(store.rounds.single.syncStatus, SyncStatus.synced);
      expect(store.rounds.single.syncError, isNull);
    });
  });

  group('API errors', () {
    test('a non-JSON reply from a proxy is reported clearly', () async {
      final client = MockClient((_) async => http.Response('<html>Bad gateway</html>', 502));
      final api = ApiClient(httpClient: client, baseUrl: () => 'http://api.test', token: () async => 't');
      await expectLater(
        api.me(),
        throwsA(isA<ApiException>().having((e) => e.isTemporary, 'temporary', isTrue)),
      );
    });

    test('field issues can be looked up by field name', () {
      const e = ApiException(422, 'VALIDATION_FAILED', 'Some fields are not valid.',
          details: [ApiIssue('email', 'must be a valid email address')]);
      expect(e.issueFor('email'), 'must be a valid email address');
      expect(e.issueFor('password'), isNull);
    });

    test('a request needing sign-in fails without a token', () async {
      final client = MockClient((_) async => fail('should not be sent'));
      final api = ApiClient(httpClient: client, baseUrl: () => 'http://api.test', token: () async => null);
      await expectLater(api.me(), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
    });
  });
}
