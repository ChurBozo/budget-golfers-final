import 'package:uuid/uuid.dart';

import 'hole.dart';
import 'shot.dart';

/// Upload state of a round on this phone.
class SyncStatus {
  SyncStatus._();

  /// Finished and waiting to upload.
  static const String pending = 'pending';

  /// Stored on the server.
  static const String synced = 'synced';

  /// The server rejected it (for example a 422); the golfer needs to fix it.
  static const String failed = 'failed';
}

/// Totals in the same shape as the API's `rounds.totals`. The server always
/// recalculates these; the phone only shows them.
class RoundTotals {
  final int strokes;
  final int toPar;
  final int putts;
  final int penalties;
  final int fairwaysHit;
  final int fairwaysPossible;
  final int greensInRegulation;
  final int holesScored;

  const RoundTotals({
    required this.strokes,
    required this.toPar,
    required this.putts,
    required this.penalties,
    required this.fairwaysHit,
    required this.fairwaysPossible,
    required this.greensInRegulation,
    required this.holesScored,
  });

  factory RoundTotals.of(List<HoleScore> holes) {
    var strokes = 0, par = 0, putts = 0, penalties = 0;
    var fwHit = 0, fwPossible = 0, gir = 0, scored = 0;
    for (final h in holes) {
      if (!h.played) continue;
      scored++;
      strokes += h.strokes;
      par += h.par;
      putts += h.putts;
      penalties += h.penalties;
      if (h.fairwayPossible) {
        fwPossible++;
        if (h.fairwayHit == true) fwHit++;
      }
      if (h.greenInRegulation == true) gir++;
    }
    return RoundTotals(
      strokes: strokes,
      toPar: strokes - par,
      putts: putts,
      penalties: penalties,
      fairwaysHit: fwHit,
      fairwaysPossible: fwPossible,
      greensInRegulation: gir,
      holesScored: scored,
    );
  }

  Map<String, dynamic> toJson() => {
        'strokes': strokes,
        'toPar': toPar,
        'putts': putts,
        'penalties': penalties,
        'fairwaysHit': fairwaysHit,
        'fairwaysPossible': fairwaysPossible,
        'greensInRegulation': greensInRegulation,
      };
}

/// A round of golf, stored on the phone until it uploads.
///
/// Courses are self-named: the golfer types the course name, so many
/// municipal courses that appear in no course database still work. The API
/// matches the name to that golfer's courses when the round uploads.
class Round {
  final String clientRoundId;
  String courseName;
  String? tee;
  final int holesPlayed; // 9 or 18
  final int startHole; // 1, or 10 for a back-nine round
  DateTime playedAt;
  final List<HoleScore> holes;
  String? notes;
  bool finished;
  String syncStatus;
  String? serverRoundId;
  DateTime? syncedAt;

  /// Why the server refused the round (a 422 reply), shown on the round.
  String? syncError;

  /// The account this round uploads to. Null until it is first uploaded, or
  /// set when a different account signs in and the golfer says the waiting
  /// rounds are not theirs.
  String? ownerUserId;
  final DateTime createdAt;
  DateTime updatedAt;
  int currentHoleIndex;

  Round({
    required this.clientRoundId,
    required this.courseName,
    this.tee,
    required this.holesPlayed,
    this.startHole = 1,
    required this.playedAt,
    required this.holes,
    this.notes,
    this.finished = false,
    this.syncStatus = SyncStatus.pending,
    this.serverRoundId,
    this.syncedAt,
    this.syncError,
    this.ownerUserId,
    required this.createdAt,
    required this.updatedAt,
    this.currentHoleIndex = 0,
  });

  /// Starts a new round. [coursePars] holds the 18 pars remembered for this
  /// course name; a 9-hole round takes the nine that are being played.
  factory Round.start({
    required String courseName,
    String? tee,
    required int holesPlayed,
    int startHole = 1,
    required List<int> coursePars,
    DateTime? playedAt,
  }) {
    assert(holesPlayed == 9 || holesPlayed == 18);
    final now = DateTime.now();
    final first = holesPlayed == 18 ? 1 : startHole;
    final holes = List<HoleScore>.generate(holesPlayed, (i) {
      final number = first + i;
      final par = (number - 1 < coursePars.length) ? coursePars[number - 1] : 4;
      return HoleScore(number: number, par: par);
    });
    return Round(
      clientRoundId: const Uuid().v4(),
      courseName: courseName.trim(),
      tee: (tee == null || tee.trim().isEmpty) ? null : tee.trim(),
      holesPlayed: holesPlayed,
      startHole: first,
      playedAt: playedAt ?? now,
      holes: holes,
      createdAt: now,
      updatedAt: now,
    );
  }

  RoundTotals get totals => RoundTotals.of(holes);

  int get parTotal => holes.fold(0, (sum, h) => sum + h.par);

  /// Hole numbers that have no strokes yet.
  List<int> get unscoredHoles =>
      holes.where((h) => !h.played).map((h) => h.number).toList();

  bool get isComplete => unscoredHoles.isEmpty;

  /// Every full shot in the round, for club stats and the shot map.
  Iterable<Shot> get allShots sync* {
    for (final h in holes) {
      yield* h.shots;
    }
  }

  void touch() => updatedAt = DateTime.now();

  Map<String, dynamic> toJson() => {
        'clientRoundId': clientRoundId,
        'courseName': courseName,
        'tee': tee,
        'holesPlayed': holesPlayed,
        'startHole': startHole,
        'playedAt': playedAt.toIso8601String(),
        'holes': holes.map((h) => h.toJson()).toList(),
        'notes': notes,
        'finished': finished,
        'syncStatus': syncStatus,
        'serverRoundId': serverRoundId,
        'syncedAt': syncedAt?.toIso8601String(),
        'syncError': syncError,
        'ownerUserId': ownerUserId,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'currentHoleIndex': currentHoleIndex,
      };

  static Round fromJson(Map<String, dynamic> m) {
    final holes = ((m['holes'] as List?) ?? const [])
        .map((e) => HoleScore.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    return Round(
      clientRoundId: m['clientRoundId'] as String,
      courseName: (m['courseName'] as String?) ?? 'Unnamed course',
      tee: m['tee'] as String?,
      holesPlayed: (m['holesPlayed'] as num?)?.toInt() ?? holes.length,
      startHole: (m['startHole'] as num?)?.toInt() ?? 1,
      playedAt: DateTime.parse(m['playedAt'] as String),
      holes: holes,
      notes: m['notes'] as String?,
      finished: (m['finished'] as bool?) ?? false,
      syncStatus: (m['syncStatus'] as String?) ?? SyncStatus.pending,
      serverRoundId: m['serverRoundId'] as String?,
      syncedAt: m['syncedAt'] == null ? null : DateTime.parse(m['syncedAt'] as String),
      syncError: m['syncError'] as String?,
      ownerUserId: m['ownerUserId'] as String?,
      createdAt: DateTime.parse(m['createdAt'] as String),
      updatedAt: DateTime.parse(m['updatedAt'] as String),
      currentHoleIndex: (m['currentHoleIndex'] as num?)?.toInt() ?? 0,
    );
  }

  /// UTC ISO-8601 with milliseconds, e.g. 2026-09-12T02:10:00.000Z.
  static String isoUtc(DateTime t) => DateTime.fromMillisecondsSinceEpoch(
        t.millisecondsSinceEpoch,
        isUtc: true,
      ).toIso8601String();

  /// The `POST /api/rounds` body (Assignment 2 `rounds_create_request.json`).
  ///
  /// The one design change: `course: { name }` replaces `courseId`, because
  /// golfers name their own courses. The API finds or creates that golfer's
  /// course from the name.
  Map<String, dynamic> toApiJson() => {
        'clientRoundId': clientRoundId,
        'course': {'name': courseName},
        if (tee != null) 'tee': tee,
        'playedAt': isoUtc(playedAt),
        'source': 'mobile-app',
        'holes': holes.where((h) => h.played).map((h) => h.toApiJson()).toList(),
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      };
}
