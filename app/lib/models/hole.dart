import 'geo.dart';
import 'shot.dart';

/// What the last button press on a hole was, so Undo can reverse it.
class HoleAction {
  HoleAction._();
  static const String shot = 'shot';
  static const String putt = 'putt';
  static const String penalty = 'penalty';
}

/// One hole of a round. Strokes are never typed in: they are the shots, putts
/// and penalty strokes recorded on the hole.
class HoleScore {
  final int number; // 1–18
  int par;
  int? distanceMetres;
  int putts;
  int penalties;
  List<Shot> shots;

  /// Order of Shot+ / Putt+ / Penalty+ presses, newest last (phone only).
  List<String> log;

  /// The golfer's own answer when the automatic one is wrong (phone only).
  bool? fairwayHitOverride;
  bool? girOverride;

  /// Red target pin set on the map for the next shot (phone only).
  LatLng? aim;

  HoleScore({
    required this.number,
    required this.par,
    this.distanceMetres,
    this.putts = 0,
    this.penalties = 0,
    List<Shot>? shots,
    List<String>? log,
    this.fairwayHitOverride,
    this.girOverride,
    this.aim,
  })  : shots = shots ?? <Shot>[],
        log = log ?? <String>[];

  int get strokes => shots.length + putts + penalties;

  bool get played => strokes > 0;

  int get toPar => strokes - par;

  String? get teeClub => shots.isNotEmpty ? shots.first.club : null;

  /// Fairways only count on par 4s and 5s.
  bool get fairwayPossible => par >= 4;

  /// From the tee shot's landing tag unless the golfer set it by hand.
  bool? get fairwayHit {
    if (!fairwayPossible) return null;
    if (fairwayHitOverride != null) return fairwayHitOverride;
    if (shots.isEmpty) return null;
    final r = shots.first.result;
    if (r == null) return null;
    return r == ShotResult.fairway;
  }

  /// Green in regulation: on the green in (par − 2) strokes or fewer.
  bool? get greenInRegulation {
    if (girOverride != null) return girOverride;
    if (!played) return null;
    return (strokes - putts) <= par - 2;
  }

  /// Records a full shot. If the previous shot has no landing point yet, it
  /// landed where this one is hit from.
  void addShot(Shot shot) {
    if (shots.isNotEmpty && shots.last.end == null && shot.start != null) {
      shots[shots.length - 1] = shots.last.copyWith(end: shot.start);
    }
    shots.add(shot);
    log.add(HoleAction.shot);
  }

  /// Records a putt. The last full shot evidently finished on the green.
  void addPutt() {
    putts++;
    if (shots.isNotEmpty && shots.last.result == null) {
      shots[shots.length - 1] = shots.last.copyWith(result: ShotResult.green);
    }
    log.add(HoleAction.putt);
  }

  /// Records a penalty stroke against the last full shot.
  void addPenalty() {
    penalties++;
    if (shots.isNotEmpty && shots.last.result == null) {
      shots[shots.length - 1] = shots.last.copyWith(result: ShotResult.penalty);
    }
    log.add(HoleAction.penalty);
  }

  /// Reverses the most recent press. Returns false when there is nothing to undo.
  bool undo() {
    if (log.isEmpty) {
      // Older data without a log: remove putts first, then shots.
      if (putts > 0) {
        putts--;
        return true;
      }
      if (penalties > 0) {
        penalties--;
        return true;
      }
      if (shots.isNotEmpty) {
        shots.removeLast();
        return true;
      }
      return false;
    }
    final last = log.removeLast();
    if (last == HoleAction.putt && putts > 0) {
      putts--;
    } else if (last == HoleAction.penalty && penalties > 0) {
      penalties--;
    } else if (last == HoleAction.shot && shots.isNotEmpty) {
      shots.removeLast();
    }
    return true;
  }

  void removeShotAt(int index) {
    if (index < 0 || index >= shots.length) return;
    shots.removeAt(index);
    final logIndex = log.lastIndexOf(HoleAction.shot);
    if (logIndex >= 0) log.removeAt(logIndex);
  }

  Map<String, dynamic> toJson() => {
        'number': number,
        'par': par,
        'distanceMetres': distanceMetres,
        'putts': putts,
        'penalties': penalties,
        'shots': shots.map((s) => s.toJson()).toList(),
        'log': log,
        'fairwayHitOverride': fairwayHitOverride,
        'girOverride': girOverride,
        'aim': aim?.toJson(),
      };

  static HoleScore fromJson(Map<String, dynamic> m) => HoleScore(
        number: (m['number'] as num).toInt(),
        par: (m['par'] as num).toInt(),
        distanceMetres: (m['distanceMetres'] as num?)?.toInt(),
        putts: (m['putts'] as num?)?.toInt() ?? 0,
        penalties: (m['penalties'] as num?)?.toInt() ?? 0,
        shots: ((m['shots'] as List?) ?? const [])
            .map((e) => Shot.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        log: ((m['log'] as List?) ?? const []).map((e) => e.toString()).toList(),
        fairwayHitOverride: m['fairwayHitOverride'] as bool?,
        girOverride: m['girOverride'] as bool?,
        aim: LatLng.fromJson(m['aim']),
      );

  /// One entry of `holes` in `POST /api/rounds`.
  Map<String, dynamic> toApiJson() {
    final fw = fairwayHit;
    final gir = greenInRegulation;
    final apiShots = <Map<String, dynamic>>[];
    for (var i = 0; i < shots.length; i++) {
      apiShots.add(shots[i].toApiJson(i + 1));
    }
    return {
      'number': number,
      'par': par,
      if (distanceMetres != null) 'distanceMetres': distanceMetres,
      'strokes': strokes,
      'putts': putts,
      'penalties': penalties,
      if (teeClub != null) 'teeClub': teeClub,
      if (fw != null) 'fairwayHit': fw,
      if (gir != null) 'greenInRegulation': gir,
      if (apiShots.isNotEmpty) 'shots': apiShots,
    };
  }
}
