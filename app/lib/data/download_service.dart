import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../models/geo.dart';
import '../models/hole.dart';
import '../models/round.dart';
import '../models/shot.dart';
import 'account_controller.dart';
import 'api_client.dart';
import 'course_repository.dart';

/// What "Download my rounds" needs from the round store (a fake is used in tests).
abstract class RoundLibrary {
  Future<List<Round>> finishedRounds();
  Future<Round?> byId(String clientRoundId);
  Future<void> save(Round round);
}

enum DownloadOutcome {
  /// The account's rounds were checked; [DownloadReport.added] are new on this phone.
  done,

  /// Not signed in, or the token ran out.
  needsSignIn,

  /// No connection, a sleeping server that did not answer in time, or a server error.
  failed,

  /// A download is already running.
  busy,
}

class DownloadReport {
  final DownloadOutcome outcome;
  final int added;
  final int alreadyHere;
  final int unreadable;
  final String? message;

  const DownloadReport(
    this.outcome, {
    this.added = 0,
    this.alreadyHere = 0,
    this.unreadable = 0,
    this.message,
  });

  /// One line for a snackbar.
  String get summary {
    switch (outcome) {
      case DownloadOutcome.needsSignIn:
        return message ?? 'Sign in to download your rounds.';
      case DownloadOutcome.busy:
        return 'Already downloading…';
      case DownloadOutcome.failed:
        return '${message ?? 'Could not download your rounds.'} If the server was asleep, press Wake up and try again.';
      case DownloadOutcome.done:
        final String main;
        if (added > 0) {
          main = 'Downloaded $added round${added == 1 ? '' : 's'}.'
              '${alreadyHere > 0 ? ' $alreadyHere ${alreadyHere == 1 ? 'was' : 'were'} already on this phone.' : ''}';
        } else if (alreadyHere > 0) {
          main = 'Every round on your account is already on this phone.';
        } else {
          main = 'There are no rounds on your account yet.';
        }
        return unreadable > 0 ? '$main $unreadable could not be read.' : main;
    }
  }
}

/// "Download my rounds": copies the rounds stored on the signed-in account
/// (from the website's seed data, or uploaded from another phone) onto this
/// phone, so Past Rounds, the shot map and club distances include them.
///
/// It uses one request, GET /api/users/:userId/export?format=json, which
/// returns every round with its holes and shots. Downloaded rounds are saved
/// as already uploaded ("synced"), so the upload queue never sends them back.
/// Rounds the phone already has (same server id or clientRoundId) are skipped,
/// so pressing the button twice is safe.
class DownloadService extends ChangeNotifier {
  final AccountController account;
  final RoundLibrary rounds;

  /// Course names the phone already remembers, and a way to remember new ones
  /// with their pars, so downloaded courses appear in New Round suggestions.
  final Future<List<String>> Function()? knownCourses;
  final Future<void> Function(String name, List<int> pars18)? rememberCourse;

  bool _busy = false;

  DownloadService({
    required this.account,
    required this.rounds,
    this.knownCourses,
    this.rememberCourse,
  });

  bool get busy => _busy;

  Future<DownloadReport> downloadMine() async {
    if (_busy) return const DownloadReport(DownloadOutcome.busy);
    final me = account.account;
    if (me == null || !account.signedIn) {
      return DownloadReport(
        DownloadOutcome.needsSignIn,
        message: account.sessionExpired ? 'Your sign-in has expired. Sign in again to download.' : null,
      );
    }

    _busy = true;
    notifyListeners();
    try {
      final result = await account.api.exportData(me.userId);
      final list = result.data['rounds'];
      if (list is! List) {
        return const DownloadReport(DownloadOutcome.failed, message: 'The server did not send any rounds.');
      }

      final local = await rounds.finishedRounds();
      final serverIds = <String>{for (final r in local) if (r.serverRoundId != null) r.serverRoundId!};
      final clientIds = <String>{for (final r in local) r.clientRoundId};
      final names = knownCourses == null ? const <String>[] : await knownCourses!();
      final courseKeys = <String>{for (final name in names) CourseRepository.keyFor(name)};

      var added = 0, alreadyHere = 0, unreadable = 0;
      for (final item in list) {
        if (item is! Map) {
          unreadable++;
          continue;
        }
        final m = Map<String, dynamic>.from(item);
        final round = roundFromApi(m, ownerUserId: me.userId);
        if (round == null) {
          unreadable++;
          continue;
        }
        if (serverIds.contains(round.serverRoundId) ||
            clientIds.contains(round.clientRoundId) ||
            await rounds.byId(round.clientRoundId) != null) {
          alreadyHere++;
          continue;
        }
        await rounds.save(round);
        serverIds.add(round.serverRoundId!);
        clientIds.add(round.clientRoundId);
        added++;

        final key = CourseRepository.keyFor(round.courseName);
        if (rememberCourse != null && !courseKeys.contains(key)) {
          final pars = List<int>.from(CourseRepository.defaultPars);
          for (final h in round.holes) {
            if (h.number >= 1 && h.number <= 18) pars[h.number - 1] = h.par;
          }
          await rememberCourse!(round.courseName, pars);
          courseKeys.add(key);
        }
      }
      return DownloadReport(
        DownloadOutcome.done,
        added: added,
        alreadyHere: alreadyHere,
        unreadable: unreadable,
      );
    } on ApiException catch (e) {
      if (e.isUnauthenticated) {
        await account.expireSession();
        return const DownloadReport(
          DownloadOutcome.needsSignIn,
          message: 'Your sign-in has expired. Sign in again to download.',
        );
      }
      return DownloadReport(DownloadOutcome.failed, message: e.message);
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Builds a phone round from one round in the API's detail shape
  /// (`GET /api/rounds/:roundId`, also used by the export). Returns null when
  /// the round has no id, date or holes.
  ///
  /// The phone works out each hole's strokes from its shots, putts and
  /// penalties. Rounds scored without GPS have no shot list on the server, so
  /// plain shots with no position are added until the strokes match. The
  /// first of them carries the tee club.
  static Round? roundFromApi(Map<String, dynamic> m, {required String ownerUserId}) {
    final id = m['id'];
    final playedAtRaw = m['playedAt'];
    if (id is! String || id.isEmpty || playedAtRaw is! String) return null;
    final playedAt = DateTime.tryParse(playedAtRaw)?.toLocal();
    if (playedAt == null) return null;

    final apiHoles = <Map<String, dynamic>>[
      for (final h in (m['holes'] as List? ?? const []))
        if (h is Map && h['number'] is num) Map<String, dynamic>.from(h),
    ]..sort((a, b) => (a['number'] as num).compareTo(b['number'] as num));
    if (apiHoles.isEmpty) return null;

    final declared = (m['holesPlayed'] as num?)?.toInt();
    final holesPlayed = declared == 9 || (declared == null && apiHoles.length <= 9) ? 9 : 18;
    final firstNumber = (apiHoles.first['number'] as num).toInt();
    final startHole = holesPlayed == 18 ? 1 : (firstNumber >= 10 ? 10 : 1);

    final byNumber = {for (final h in apiHoles) (h['number'] as num).toInt(): h};
    final holes = <HoleScore>[
      for (var n = startHole; n < startHole + holesPlayed; n++)
        byNumber[n] != null
            ? _holeFromApi(byNumber[n]!, playedAt)
            : HoleScore(number: n, par: CourseRepository.defaultPars[n - 1]),
    ];

    final course = m['course'] is Map ? Map<String, dynamic>.from(m['course'] as Map) : const <String, dynamic>{};
    final courseName = (course['name'] as String?)?.trim();
    final clientRoundId = m['clientRoundId'];
    final syncedAt = m['syncedAt'] is String ? DateTime.tryParse(m['syncedAt'] as String) : null;
    final now = DateTime.now();

    return Round(
      // Rounds entered on the website have no clientRoundId; this id stays
      // within the API's rule of 8–64 letters, numbers, - and _.
      clientRoundId: clientRoundId is String && clientRoundId.isNotEmpty ? clientRoundId : 'server-$id',
      courseName: courseName == null || courseName.isEmpty ? 'Unnamed course' : courseName,
      tee: m['tee'] as String?,
      holesPlayed: holesPlayed,
      startHole: startHole,
      playedAt: playedAt,
      holes: holes,
      notes: m['notes'] as String?,
      finished: true,
      syncStatus: SyncStatus.synced,
      serverRoundId: id,
      syncedAt: syncedAt ?? now,
      ownerUserId: ownerUserId,
      createdAt: now,
      updatedAt: now,
    );
  }

  static HoleScore _holeFromApi(Map<String, dynamic> h, DateTime ts) {
    int count(String key) => math.max(0, (h[key] as num?)?.toInt() ?? 0);
    final strokes = count('strokes');
    final putts = count('putts');
    final penalties = count('penalties');

    final apiShots = <Map<String, dynamic>>[
      for (final s in (h['shots'] as List? ?? const []))
        if (s is Map) Map<String, dynamic>.from(s),
    ]..sort((a, b) => ((a['seq'] as num?) ?? 0).compareTo((b['seq'] as num?) ?? 0));

    final shots = <Shot>[
      for (final s in apiShots)
        Shot(
          id: const Uuid().v4(),
          ts: ts,
          club: s['club'] as String?,
          start: LatLng.fromJson(s['start']),
          end: LatLng.fromJson(s['end']),
          result: s['result'] as String?,
        ),
    ];
    final fullShots = math.max(0, strokes - putts - penalties);
    while (shots.length < fullShots) {
      shots.add(Shot(
        id: const Uuid().v4(),
        ts: ts,
        club: shots.isEmpty ? h['teeClub'] as String? : null,
      ));
    }

    return HoleScore(
      number: (h['number'] as num).toInt(),
      par: (h['par'] as num?)?.toInt() ?? 4,
      distanceMetres: (h['distanceMetres'] as num?)?.toInt(),
      putts: putts,
      penalties: penalties,
      shots: shots,
      fairwayHitOverride: h['fairwayHit'] is bool ? h['fairwayHit'] as bool : null,
      girOverride: h['greenInRegulation'] is bool ? h['greenInRegulation'] as bool : null,
    );
  }
}
