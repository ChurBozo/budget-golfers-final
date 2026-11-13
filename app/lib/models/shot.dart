import 'geo.dart';

/// Where a shot finished. Values match the API's `shots[].result`.
class ShotResult {
  ShotResult._();

  static const String fairway = 'fairway';
  static const String roughLeft = 'rough-left';
  static const String roughRight = 'rough-right';
  static const String bunker = 'bunker';
  static const String green = 'green';
  static const String penalty = 'penalty';

  static const List<String> all = [
    fairway,
    roughLeft,
    roughRight,
    bunker,
    green,
    penalty,
  ];

  static String label(String? result) {
    switch (result) {
      case fairway:
        return 'Fairway';
      case roughLeft:
        return 'Rough L';
      case roughRight:
        return 'Rough R';
      case bunker:
        return 'Bunker';
      case green:
        return 'Green';
      case penalty:
        return 'Penalty';
      default:
        return 'Not tagged';
    }
  }

  /// True when the result is a miss to the left or right of the line.
  static bool isMiss(String? result) =>
      result == roughLeft || result == roughRight || result == bunker || result == penalty;
}

/// One full shot (not a putt). Ported from the old `ShotEvent`: it keeps the
/// start, the aimed-at target and where the ball landed, so the same accuracy
/// and left/right maths still work.
class Shot {
  final String id;
  final DateTime ts;
  final String? club; // API club code, e.g. "7i"
  final LatLng? start;
  final LatLng? target; // phone only; the API design has no target field
  final LatLng? end; // where the ball landed
  final String? result; // ShotResult value

  const Shot({
    required this.id,
    required this.ts,
    this.club,
    this.start,
    this.target,
    this.end,
    this.result,
  });

  Shot copyWith({
    String? club,
    LatLng? start,
    LatLng? target,
    LatLng? end,
    String? result,
    bool clearResult = false,
    bool clearEnd = false,
  }) {
    return Shot(
      id: id,
      ts: ts,
      club: club ?? this.club,
      start: start ?? this.start,
      target: target ?? this.target,
      end: clearEnd ? null : (end ?? this.end),
      result: clearResult ? null : (result ?? this.result),
    );
  }

  /// Distance the ball actually travelled (start → landing), in metres.
  double? get distanceM =>
      (start != null && end != null) ? Geo.distanceM(start!, end!) : null;

  /// Distance the golfer meant to hit (start → target), in metres.
  double? get intendedM =>
      (start != null && target != null) ? Geo.distanceM(start!, target!) : null;

  /// How far the ball finished from the target, in metres.
  double? get missM =>
      (end != null && target != null) ? Geo.distanceM(end!, target!) : null;

  /// 100% = landed on the target, 0% = missed by the whole intended distance.
  double? get accuracyPct {
    final miss = missM;
    final base = intendedM ?? distanceM;
    if (miss == null || base == null || base <= 0) return null;
    final pct = 100.0 * (1.0 - miss / base);
    if (pct.isNaN || pct.isInfinite) return null;
    return pct.clamp(0.0, 100.0).toDouble();
  }

  /// Degrees off the target line: positive right, negative left.
  double? get biasDeg => (start != null && target != null && end != null)
      ? Geo.biasDeg(start!, target!, end!)
      : null;

  double? get lateralMissM => (start != null && target != null && end != null)
      ? Geo.lateralMissM(start!, target!, end!)
      : null;

  double? get forwardMissM => (start != null && target != null && end != null)
      ? Geo.forwardMissM(start!, target!, end!)
      : null;

  /// Everything, for storage on the phone.
  Map<String, dynamic> toJson() => {
        'id': id,
        'ts': ts.toIso8601String(),
        'club': club,
        'start': start?.toJson(),
        'target': target?.toJson(),
        'end': end?.toJson(),
        'result': result,
      };

  static Shot fromJson(Map<String, dynamic> m) => Shot(
        id: m['id'] as String,
        ts: DateTime.parse(m['ts'] as String),
        club: m['club'] as String?,
        start: LatLng.fromJson(m['start']),
        target: LatLng.fromJson(m['target']),
        end: LatLng.fromJson(m['end']),
        result: m['result'] as String?,
      );

  /// One entry of `holes[].shots` in `POST /api/rounds`.
  Map<String, dynamic> toApiJson(int seq) {
    final d = distanceM;
    return {
      'seq': seq,
      if (club != null) 'club': club,
      if (start != null) 'start': start!.toJson(),
      if (end != null) 'end': end!.toJson(),
      if (d != null) 'distanceMetres': d.round(),
      if (result != null) 'result': result,
    };
  }
}
