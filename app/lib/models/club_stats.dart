import 'dart:math' as math;

import 'clubs.dart';
import 'round.dart';

/// Per-club numbers, ported from the old `ClubSummary`. The averages follow
/// the API rule: a club needs [ClubStats.minimumShots] measured shots before
/// its distance counts.
class ClubSummary {
  final String code;
  final int shots; // shots hit with this club
  final int measuredShots; // shots with both a start and a landing point
  final double? avgDistM;
  final double? longestM;
  final double? spreadM; // standard deviation of distance
  final double? avgAccPct; // 0–100, higher is better
  final double? avgBiasDeg; // + right, − left
  final double? medianMissM;

  const ClubSummary({
    required this.code,
    required this.shots,
    required this.measuredShots,
    this.avgDistM,
    this.longestM,
    this.spreadM,
    this.avgAccPct,
    this.avgBiasDeg,
    this.medianMissM,
  });

  bool get enoughData => measuredShots >= ClubStats.minimumShots;

  String get label => Clubs.label(code);
}

class ClubStats {
  ClubStats._();

  /// Same 5-shot minimum as `GET /api/clubs/:userId`.
  static const int minimumShots = 5;

  /// Same rule as the API: chips under 30 m say nothing about a club's full
  /// swing, so they are left out of its average.
  static const double minShotMetres = 30;

  /// Works out a summary for every club used in [rounds].
  static Map<String, ClubSummary> compute(Iterable<Round> rounds) {
    final counts = <String, int>{};
    final dists = <String, List<double>>{};
    final accs = <String, List<double>>{};
    final biases = <String, List<double>>{};
    final misses = <String, List<double>>{};

    for (final r in rounds) {
      for (final s in r.allShots) {
        final club = s.club;
        if (club == null || club == 'putter') continue;
        counts[club] = (counts[club] ?? 0) + 1;
        final d = s.distanceM;
        if (d != null && d >= minShotMetres) (dists[club] ??= <double>[]).add(d);
        final a = s.accuracyPct;
        if (a != null) (accs[club] ??= <double>[]).add(a);
        final b = s.biasDeg;
        if (b != null) (biases[club] ??= <double>[]).add(b);
        final m = s.missM;
        if (m != null) (misses[club] ??= <double>[]).add(m);
      }
    }

    final out = <String, ClubSummary>{};
    for (final club in counts.keys) {
      final d = dists[club] ?? const <double>[];
      final enough = d.length >= minimumShots;
      out[club] = ClubSummary(
        code: club,
        shots: counts[club]!,
        measuredShots: d.length,
        avgDistM: enough ? mean(d) : null,
        longestM: enough ? d.reduce(math.max) : null,
        spreadM: enough ? stdev(d) : null,
        avgAccPct: mean(accs[club]),
        avgBiasDeg: mean(biases[club]),
        medianMissM: median(misses[club]),
      );
    }
    return out;
  }

  /// Distance to use for each club: the measured average when there are
  /// enough shots, otherwise the distance the golfer typed into My Bag.
  static Map<String, double> distancesFor(
    Map<String, ClubSummary> summaries,
    List<BagClub> bag,
  ) {
    final out = <String, double>{};
    for (final b in bag) {
      if (!b.inBag || b.code == 'putter') continue;
      final measured = summaries[b.code]?.avgDistM;
      final value = measured ?? b.manualMetres;
      if (value != null && value > 0) out[b.code] = value;
    }
    return out;
  }

  /// Club suggestion, ported from the old `_suggestClubByAvgs`: the shortest
  /// club that still reaches [metres]; if none does, the longest club.
  /// Without any distances it falls back to rough amateur ranges.
  static String suggest(double metres, Map<String, double> distances) {
    if (metres < 15) return 'putter';
    if (distances.isEmpty) {
      if (metres < 45) return 'sw';
      if (metres < 100) return 'pw';
      if (metres < 130) return '8i';
      if (metres < 150) return '6i';
      if (metres < 190) return '5h';
      return 'driver';
    }
    final entries = distances.entries.toList()
      ..sort((a, b) {
        final byDist = a.value.compareTo(b.value);
        return byDist != 0 ? byDist : Clubs.order(b.key).compareTo(Clubs.order(a.key));
      });
    for (final e in entries) {
      if (e.value >= metres) return e.key;
    }
    return entries.last.key;
  }

  static double? mean(List<double>? xs) {
    if (xs == null || xs.isEmpty) return null;
    return xs.reduce((a, b) => a + b) / xs.length;
  }

  static double? median(List<double>? xs) {
    if (xs == null || xs.isEmpty) return null;
    final s = [...xs]..sort();
    final mid = s.length ~/ 2;
    return s.length.isOdd ? s[mid] : (s[mid - 1] + s[mid]) / 2.0;
  }

  static double? stdev(List<double>? xs) {
    if (xs == null || xs.length < 2) return null;
    final mu = mean(xs)!;
    final sum = xs.fold<double>(0, (acc, x) => acc + (x - mu) * (x - mu));
    return math.sqrt(sum / (xs.length - 1));
  }
}
