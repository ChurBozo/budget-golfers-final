import 'dart:async';
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../app.dart';
import '../data/bag_repository.dart';
import '../data/round_repository.dart';
import '../models/club_stats.dart';
import '../models/clubs.dart';
import '../models/round.dart';
import '../services.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/controller_dialog.dart';
import '../widgets/stat_tile.dart';

/// Profile: Clubs, Performance and Accuracy tabs, ported from the old app.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<BagClub>? _bag;
  List<Round> _rounds = const [];
  Map<String, ClubSummary> _summaries = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final bag = await BagRepository.instance.load();
    final rounds = await RoundRepository.instance.finishedRounds();
    if (!mounted) return;
    setState(() {
      _bag = bag;
      _rounds = rounds;
      _summaries = ClubStats.compute(rounds);
    });
  }

  Future<void> _saveBag(List<BagClub> bag) async {
    setState(() => _bag = bag);
    await BagRepository.instance.saveAll(bag);
    // Keep the website's bag the same as the phone's.
    if (Services.account.signedIn) unawaited(Services.uploads.syncBag());
  }

  @override
  Widget build(BuildContext context) {
    final bag = _bag;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Profile'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Clubs'),
              Tab(text: 'Performance'),
              Tab(text: 'Accuracy'),
            ],
          ),
        ),
        body: bag == null
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _ClubsTab(bag: bag, summaries: _summaries, onChanged: _saveBag),
                  _PerformanceTab(rounds: _rounds),
                  _AccuracyTab(summaries: _summaries),
                ],
              ),
      ),
    );
  }
}

// ── Clubs ──────────────────────────────────────────────────────────────

class _ClubsTab extends StatelessWidget {
  final List<BagClub> bag;
  final Map<String, ClubSummary> summaries;
  final ValueChanged<List<BagClub>> onChanged;

  const _ClubsTab({required this.bag, required this.summaries, required this.onChanged});

  int get _inBag => bag.where((b) => b.inBag).length;

  void _toggle(BuildContext context, int i, bool value) {
    if (value && _inBag >= Clubs.maxInBag) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('The rules allow 14 clubs. Take one out first.')),
      );
      return;
    }
    final next = [...bag];
    next[i] = next[i].copyWith(inBag: value);
    onChanged(next);
  }

  Future<void> _editDistance(BuildContext context, int i) async {
    final metric = AppScope.read(context).metric;
    final club = bag[i];
    final initial = club.manualMetres == null
        ? ''
        : Fmt.fromMetres(club.manualMetres!, metric: metric).round().toString();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => ControllerDialog(
        initialText: initial,
        builder: (context, controller) => AlertDialog(
          title: Text(club.label),
          content: TextField(
            controller: controller,
            keyboardType: TextInputType.number,
            autofocus: true,
            decoration: InputDecoration(
              labelText: 'Your usual distance',
              suffixText: Fmt.unit(metric),
              helperText: 'Used until this club has ${ClubStats.minimumShots} measured shots.',
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, 'clear'), child: const Text('Clear')),
            FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (result == null) return;
    final next = [...bag];
    if (result == 'clear') {
      next[i] = club.copyWith(clearManual: true);
    } else {
      final value = double.tryParse(result.trim());
      if (value == null || value <= 0) return;
      next[i] = club.copyWith(manualMetres: Fmt.toMetres(value, metric: metric));
    }
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final metric = AppScope.of(context).metric;
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Text(
            'In your bag: $_inBag of ${Clubs.maxInBag}. Tap a club to type your usual distance.',
            style: theme.textTheme.bodyMedium,
          ),
        ),
        for (var i = 0; i < bag.length; i++)
          Builder(builder: (context) {
            final b = bag[i];
            final s = summaries[b.code];
            final String detail;
            if (s != null && s.enoughData) {
              detail = 'Average ${Fmt.distance(s.avgDistM, metric: metric)} from ${s.measuredShots} shots'
                  ' · longest ${Fmt.distance(s.longestM, metric: metric)}';
            } else if (b.manualMetres != null) {
              detail = 'Your distance ${Fmt.distance(b.manualMetres, metric: metric)}'
                  '${s == null ? '' : ' · ${s.measuredShots} of ${ClubStats.minimumShots} shots measured'}';
            } else if (s != null) {
              detail = '${s.measuredShots} of ${ClubStats.minimumShots} shots measured';
            } else {
              detail = b.code == 'putter' ? 'Putts are counted on the scorecard' : 'No shots yet';
            }
            return Card(
              elevation: 0,
              margin: const EdgeInsets.symmetric(vertical: 3),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: b.inBag ? Palette.bottleGreen : theme.colorScheme.surfaceContainerHighest,
                  foregroundColor: b.inBag ? Colors.white : null,
                  child: Text(Clubs.short(b.code), style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                title: Text(b.label),
                subtitle: Text(detail),
                trailing: Switch(value: b.inBag, onChanged: (v) => _toggle(context, i, v)),
                onTap: b.code == 'putter' ? null : () => _editDistance(context, i),
              ),
            );
          }),
      ],
    );
  }
}

// ── Performance ────────────────────────────────────────────────────────

class _PerformanceTab extends StatelessWidget {
  final List<Round> rounds;

  const _PerformanceTab({required this.rounds});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (rounds.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('Finish a round to see your performance here.', textAlign: TextAlign.center),
        ),
      );
    }

    final eighteens = rounds.where((r) => r.holesPlayed == 18).toList();
    final nines = rounds.where((r) => r.holesPlayed == 9).toList();
    double? avgOf(List<Round> rs) => rs.isEmpty
        ? null
        : rs.map((r) => r.totals.strokes).reduce((a, b) => a + b) / rs.length;

    var holes = 0, putts = 0, fwHit = 0, fwPossible = 0, gir = 0;
    var birdies = 0, pars = 0, bogeys = 0, doubles = 0;
    for (final r in rounds) {
      final t = r.totals;
      holes += t.holesScored;
      putts += t.putts;
      fwHit += t.fairwaysHit;
      fwPossible += t.fairwaysPossible;
      gir += t.greensInRegulation;
      for (final h in r.holes) {
        if (!h.played) continue;
        final d = h.toPar;
        if (d <= -1) {
          birdies++;
        } else if (d == 0) {
          pars++;
        } else if (d == 1) {
          bogeys++;
        } else {
          doubles++;
        }
      }
    }
    final puttsPer18 = holes == 0 ? null : putts / holes * 18;

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.45,
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          children: [
            StatTile(
              label: 'Average score',
              value: Fmt.oneDecimal(avgOf(eighteens)),
              caption: '${eighteens.length} rounds of 18',
            ),
            StatTile(
              label: '9-hole average',
              value: Fmt.oneDecimal(avgOf(nines)),
              caption: '${nines.length} rounds of 9',
            ),
            StatTile(label: 'Putts per 18', value: Fmt.oneDecimal(puttsPer18)),
            StatTile(label: 'Rounds played', value: '${rounds.length}'),
            StatTile(
              label: 'Fairways hit',
              value: fwPossible == 0 ? '—' : '${(100 * fwHit / fwPossible).round()}',
              suffix: fwPossible == 0 ? null : '%',
            ),
            StatTile(
              label: 'Greens in reg.',
              value: holes == 0 ? '—' : '${(100 * gir / holes).round()}',
              suffix: holes == 0 ? null : '%',
            ),
          ],
        ),
        SectionCard(
          title: 'Score trend (to par)',
          trailing: Text('Last ${math.min(rounds.length, 20)}', style: theme.textTheme.bodySmall),
          child: SizedBox(height: 200, child: _TrendChart(rounds: rounds)),
        ),
        SectionCard(
          title: 'Score distribution',
          child: Column(
            children: [
              _DistributionBar(label: 'Birdie or better', count: birdies, total: holes, colour: Palette.bottleGreen),
              _DistributionBar(label: 'Par', count: pars, total: holes, colour: Palette.turquoise),
              _DistributionBar(label: 'Bogey', count: bogeys, total: holes, colour: Palette.sand),
              _DistributionBar(label: 'Double or worse', count: doubles, total: holes, colour: Palette.flagRed),
            ],
          ),
        ),
      ],
    );
  }
}

class _TrendChart extends StatelessWidget {
  final List<Round> rounds; // newest first

  const _TrendChart({required this.rounds});

  @override
  Widget build(BuildContext context) {
    final recent = rounds.take(20).toList().reversed.toList();
    final spots = <FlSpot>[
      for (var i = 0; i < recent.length; i++) FlSpot(i.toDouble(), recent[i].totals.toPar.toDouble()),
    ];
    final rolling = <FlSpot>[];
    for (var i = 0; i < recent.length; i++) {
      final from = math.max(0, i - 4);
      final window = recent.sublist(from, i + 1);
      final avg = window.map((r) => r.totals.toPar).reduce((a, b) => a + b) / window.length;
      rolling.add(FlSpot(i.toDouble(), avg));
    }
    final ys = spots.map((s) => s.y);
    final minY = (ys.reduce(math.min) - 2).floorToDouble();
    final maxY = (ys.reduce(math.max) + 2).ceilToDouble();
    final textStyle = Theme.of(context).textTheme.bodySmall;

    return LineChart(
      LineChartData(
        minX: 0,
        maxX: math.max(1, recent.length - 1).toDouble(),
        minY: minY,
        maxY: maxY,
        gridData: const FlGridData(show: true, drawVerticalLine: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 34,
              getTitlesWidget: (value, meta) => Text(Fmt.toPar(value.round()), style: textStyle),
            ),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            color: Palette.bottleGreen,
            barWidth: 3,
            dotData: const FlDotData(show: true),
          ),
          if (recent.length > 1)
            LineChartBarData(
              spots: rolling,
              color: Palette.turquoise,
              barWidth: 2,
              dashArray: const [6, 4],
              dotData: const FlDotData(show: false),
            ),
        ],
      ),
    );
  }
}

class _DistributionBar extends StatelessWidget {
  final String label;
  final int count;
  final int total;
  final Color colour;

  const _DistributionBar({required this.label, required this.count, required this.total, required this.colour});

  @override
  Widget build(BuildContext context) {
    final share = total == 0 ? 0.0 : count / total;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(width: 128, child: Text(label)),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: share,
                minHeight: 12,
                color: colour,
                backgroundColor: colour.withValues(alpha: 0.15),
              ),
            ),
          ),
          SizedBox(width: 48, child: Text('$count', textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}

// ── Accuracy ───────────────────────────────────────────────────────────

class _AccuracyTab extends StatelessWidget {
  final Map<String, ClubSummary> summaries;

  const _AccuracyTab({required this.summaries});

  @override
  Widget build(BuildContext context) {
    final metric = AppScope.of(context).metric;
    final theme = Theme.of(context);
    final list = summaries.values.where((s) => s.avgAccPct != null || s.avgDistM != null).toList()
      ..sort((a, b) => Clubs.order(a.code).compareTo(Clubs.order(b.code)));
    if (list.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Aim with the red pin on the map and mark where the ball landed. '
            'Accuracy and left/right bias for each club will show here.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Text(
            'Accuracy: 100% means the ball finished on the target. Bias: how far off the target line '
            'the ball finishes on average, right or left.',
            style: theme.textTheme.bodySmall,
          ),
        ),
        for (final s in list)
          SectionCard(
            title: s.label,
            trailing: Text('${s.shots} shots', style: theme.textTheme.bodySmall),
            child: Wrap(
              spacing: 18,
              runSpacing: 8,
              children: [
                _Metric(label: 'Accuracy', value: Fmt.percent(s.avgAccPct)),
                _Metric(label: 'Bias', value: Fmt.bias(s.avgBiasDeg)),
                _Metric(label: 'Median miss', value: Fmt.distance(s.medianMissM, metric: metric)),
                _Metric(label: 'Average', value: Fmt.distance(s.avgDistM, metric: metric)),
                _Metric(label: 'Spread', value: Fmt.distance(s.spreadM, metric: metric)),
              ],
            ),
          ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;

  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label.toUpperCase(), style: theme.textTheme.labelSmall),
        Text(value, style: theme.textTheme.titleMedium),
      ],
    );
  }
}
