import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart' as geo;
import 'package:uuid/uuid.dart';

import '../app.dart';
import '../data/bag_repository.dart';
import '../data/course_repository.dart';
import '../data/round_repository.dart';
import '../models/club_stats.dart';
import '../models/clubs.dart';
import '../models/geo.dart';
import '../models/hole.dart';
import '../models/round.dart';
import '../models/shot.dart';
import '../services.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/location.dart';
import '../widgets/club_picker.dart';
import '../widgets/controller_dialog.dart';
import '../widgets/scorecard.dart';
import 'map_screen.dart';
import 'round_detail_screen.dart';

/// Scoring a round, ported from the old `NewRoundPage`: Shot+, Putt+,
/// Penalty, Undo, swipe between holes, score colours against par and an
/// autosave after every press.
class ScoringScreen extends StatefulWidget {
  final Round round;

  const ScoringScreen({super.key, required this.round});

  @override
  State<ScoringScreen> createState() => _ScoringScreenState();
}

class _ScoringScreenState extends State<ScoringScreen> {
  late Round _round;
  late int _index;

  StreamSubscription<geo.Position>? _gps;
  final List<geo.Position> _fixes = [];
  LocationState? _gpsState;

  List<BagClub> _bag = const [];
  Map<String, double> _distances = const {};
  bool _busy = false;

  HoleScore get _hole => _round.holes[_index];

  @override
  void initState() {
    super.initState();
    _round = widget.round;
    _index = _round.currentHoleIndex.clamp(0, _round.holes.length - 1);
    _loadClubs();
    _startGps();
  }

  @override
  void dispose() {
    _gps?.cancel();
    super.dispose();
  }

  Future<void> _loadClubs() async {
    final bag = await BagRepository.instance.load();
    final rounds = await RoundRepository.instance.finishedRounds();
    final summaries = ClubStats.compute(rounds);
    if (!mounted) return;
    setState(() {
      _bag = bag;
      _distances = ClubStats.distancesFor(summaries, bag);
    });
  }

  Future<void> _startGps() async {
    final state = await LocationService.ensureReady();
    if (!mounted) return;
    setState(() => _gpsState = state);
    if (state != LocationState.ready) return;
    _gps = LocationService.stream().listen(
      (p) {
        _fixes.add(p);
        if (_fixes.length > 10) _fixes.removeAt(0);
        if (mounted) setState(() {});
      },
      onError: (Object _) {},
    );
  }

  LatLng? get _here => LocationService.average(_fixes);

  double? get _lastAccuracy => _fixes.isEmpty ? null : _fixes.last.accuracy;

  Future<void> _save() async {
    _round.currentHoleIndex = _index;
    await RoundRepository.instance.save(_round);
  }

  // ── Scoring buttons ──────────────────────────────────────────────

  Future<void> _shotPlus({LatLng? start, LatLng? target, String? club}) async {
    if (_busy) return;
    setState(() => _busy = true);
    var from = start ?? _here;
    if (from == null && _gpsState == LocationState.ready) {
      from = await LocationService.current();
    }
    if (!mounted) return;
    final settings = AppScope.read(context);
    final shot = Shot(
      id: const Uuid().v4(),
      ts: DateTime.now(),
      club: club ?? settings.currentClub,
      start: from,
      target: target ?? _hole.aim,
    );
    setState(() {
      _hole.addShot(shot);
      _hole.aim = null;
      _busy = false;
    });
    await _save();
  }

  Future<void> _puttPlus() async {
    setState(_hole.addPutt);
    await _save();
  }

  Future<void> _penaltyPlus() async {
    setState(_hole.addPenalty);
    await _save();
  }

  Future<void> _undo() async {
    var changed = false;
    setState(() {
      changed = _hole.undo();
    });
    if (changed) await _save();
  }

  void _goTo(int index) {
    if (index < 0 || index >= _round.holes.length) return;
    setState(() => _index = index);
    _save();
  }

  // ── Hole details ─────────────────────────────────────────────────

  Future<void> _editPar() async {
    final par = await showDialog<int>(
      context: context,
      builder: (context) => SimpleDialog(
        title: Text('Par for hole ${_hole.number}'),
        children: [
          for (final p in const [3, 4, 5, 6])
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, p),
              child: Text('Par $p', style: const TextStyle(fontSize: 18)),
            ),
        ],
      ),
    );
    if (par == null || !mounted) return;
    setState(() => _hole.par = par);
    await CourseRepository.instance.setPar(_round.courseName, _hole.number, par);
    await _save();
  }

  Future<void> _chooseClub() async {
    final settings = AppScope.read(context);
    final here = _here;
    final aim = _hole.aim;
    final toAim = (here != null && aim != null) ? Geo.distanceM(here, aim) : null;
    final code = await showClubPicker(
      context,
      bag: _bag,
      distances: _distances,
      metric: settings.metric,
      current: settings.currentClub,
      suggested: toAim == null ? null : ClubStats.suggest(toAim, _distances),
      targetMetres: toAim,
    );
    if (code == null) return;
    await settings.setCurrentClub(code);
  }

  Future<void> _setResult(int shotIndex, String? result) async {
    setState(() {
      final s = _hole.shots[shotIndex];
      _hole.shots[shotIndex] =
          result == null ? s.copyWith(clearResult: true) : s.copyWith(result: result);
    });
    await _save();
  }

  Future<void> _editShot(int i) async {
    final settings = AppScope.read(context);
    final shot = _hole.shots[i];
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text('Shot ${i + 1} · ${Clubs.label(shot.club)}'),
              subtitle: Text(
                [
                  if (shot.distanceM != null) Fmt.distance(shot.distanceM, metric: settings.metric),
                  ShotResult.label(shot.result),
                  if (shot.missM != null)
                    '${Fmt.distance(shot.missM, metric: settings.metric)} from target',
                ].join(' · '),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.sports_golf),
              title: const Text('Change club'),
              onTap: () => Navigator.pop(context, 'club'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Palette.flagRed),
              title: const Text('Delete this shot'),
              onTap: () => Navigator.pop(context, 'delete'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || action == null) return;
    if (action == 'delete') {
      setState(() => _hole.removeShotAt(i));
      await _save();
    } else if (action == 'club') {
      final code = await showClubPicker(
        context,
        bag: _bag,
        distances: _distances,
        metric: settings.metric,
        current: shot.club,
      );
      if (code == null || !mounted) return;
      setState(() => _hole.shots[i] = shot.copyWith(club: code));
      await _save();
    }
  }

  // ── Map ──────────────────────────────────────────────────────────

  Future<void> _openMap() async {
    final result = await Navigator.of(context).push<MapResult>(
      MaterialPageRoute(
        builder: (_) => MapScreen(
          holeNumber: _hole.number,
          par: _hole.par,
          aim: _hole.aim,
          lastShot: _hole.shots.isEmpty ? null : _hole.shots.last,
          bag: _bag,
          distances: _distances,
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      final landed = result.landed;
      if (landed != null && _hole.shots.isNotEmpty) {
        _hole.shots[_hole.shots.length - 1] = _hole.shots.last.copyWith(end: landed);
      }
      _hole.aim = result.aim;
    });
    if (result.hitShot) {
      await _shotPlus(start: result.shotStart, target: result.aim, club: result.club);
    } else {
      await _save();
    }
  }

  // ── Finish ───────────────────────────────────────────────────────

  Future<void> _finish() async {
    final missing = _round.unscoredHoles;
    if (missing.isNotEmpty) {
      final go = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Some holes have no score'),
          content: Text(
            'Hole${missing.length == 1 ? '' : 's'} ${missing.join(', ')} '
            '${missing.length == 1 ? 'has' : 'have'} no strokes yet. Every hole needs a score '
            'before the round can be saved and uploaded.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Close')),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('Go to hole ${missing.first}'),
            ),
          ],
        ),
      );
      if (go == true && mounted) {
        _goTo(_round.holes.indexWhere((h) => h.number == missing.first));
      }
      return;
    }

    final totals = _round.totals;
    // null = keep playing; a string (maybe empty) = finish with these notes.
    final finishedNotes = await showDialog<String>(
      context: context,
      builder: (context) => ControllerDialog(
        initialText: _round.notes ?? '',
        builder: (context, notes) => AlertDialog(
          title: const Text('Finish round?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_round.courseName}: ${totals.strokes} (${Fmt.toPar(totals.toPar)}), '
                '${totals.putts} putts.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notes,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  hintText: 'e.g. Windy back nine',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Keep playing')),
            FilledButton(onPressed: () => Navigator.pop(context, notes.text), child: const Text('Finish')),
          ],
        ),
      ),
    );
    if (finishedNotes == null || !mounted) return;
    final noteText = finishedNotes.trim();

    _round
      ..notes = noteText.isEmpty ? null : noteText
      ..finished = true
      ..syncStatus = SyncStatus.pending;
    await _save();

    // Remember this course's pars for next time.
    final pars = await CourseRepository.instance.parsFor(_round.courseName);
    for (final h in _round.holes) {
      pars[h.number - 1] = h.par;
    }
    await CourseRepository.instance.save(_round.courseName, pars);

    // Upload straight away when signed in. With no signal the round waits
    // in the queue and goes up when the phone reconnects.
    if (Services.account.signedIn) unawaited(Services.uploads.uploadPending());

    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => RoundDetailScreen(round: _round)),
    );
  }

  // ── UI ───────────────────────────────────────────────────────────

  String get _gpsLabel {
    switch (_gpsState) {
      case null:
        return 'GPS starting…';
      case LocationState.serviceOff:
        return 'GPS is off';
      case LocationState.denied:
      case LocationState.deniedForever:
        return 'No location permission';
      case LocationState.ready:
        final acc = _lastAccuracy;
        return acc == null ? 'Waiting for GPS…' : 'GPS ±${acc.round()} m';
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = AppScope.of(context);
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final hole = _hole;
    final totals = _round.totals;
    final here = _here;
    final toAim = (here != null && hole.aim != null) ? Geo.distanceM(here, hole.aim!) : null;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_round.courseName, overflow: TextOverflow.ellipsis),
            Text(
              '${totals.strokes} (${Fmt.toPar(totals.toPar)}) after ${totals.holesScored} · $_gpsLabel',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: _finish,
            icon: const Icon(Icons.flag),
            label: const Text('Finish'),
          ),
        ],
      ),
      body: GestureDetector(
        onHorizontalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v < -250) _goTo(_index + 1);
          if (v > 250) _goTo(_index - 1);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
          children: [
            // Hole header
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                child: Row(
                  children: [
                    IconButton(
                      iconSize: 32,
                      onPressed: _index > 0 ? () => _goTo(_index - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Expanded(
                      child: Column(
                        children: [
                          Text('Hole ${hole.number}', style: theme.textTheme.headlineSmall),
                          const SizedBox(height: 4),
                          ActionChip(
                            avatar: const Icon(Icons.edit, size: 16),
                            label: Text('Par ${hole.par}'),
                            onPressed: _editPar,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 76,
                      height: 76,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: hole.played
                            ? AppTheme.scoreColour(hole.strokes, hole.par, dark: dark)
                            : theme.colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: theme.colorScheme.outlineVariant),
                      ),
                      child: Text(
                        hole.played ? '${hole.strokes}' : '–',
                        style: TextStyle(
                          fontSize: 38,
                          fontWeight: FontWeight.w800,
                          color: hole.played
                              ? AppTheme.onScoreColour(hole.strokes, hole.par, dark: dark)
                              : null,
                        ),
                      ),
                    ),
                    IconButton(
                      iconSize: 32,
                      onPressed: _index < _round.holes.length - 1 ? () => _goTo(_index + 1) : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                'Shots ${hole.shots.length} · Putts ${hole.putts} · Penalties ${hole.penalties}',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ),

            // Club + aim
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _chooseClub,
                    icon: const Icon(Icons.sports_golf),
                    label: Text(
                      settings.currentClub == null ? 'Choose club' : Clubs.label(settings.currentClub),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _openMap,
                    icon: const Icon(Icons.map),
                    label: Text(
                      toAim == null ? 'Map' : 'Target ${Fmt.distance(toAim, metric: settings.metric)}',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Big scoring buttons
            Row(
              children: [
                Expanded(
                  child: _BigButton(
                    label: 'Shot +',
                    icon: Icons.add_circle,
                    filled: true,
                    onPressed: _busy ? null : () => _shotPlus(),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _BigButton(
                    label: 'Putt +',
                    icon: Icons.flag_circle,
                    filled: true,
                    onPressed: _puttPlus,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _BigButton(label: 'Penalty', icon: Icons.warning_amber, onPressed: _penaltyPlus),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _BigButton(label: 'Undo', icon: Icons.undo, onPressed: _undo),
                ),
              ],
            ),

            // Shots on this hole
            if (hole.shots.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text('Shots on this hole', style: theme.textTheme.titleMedium),
              for (var i = 0; i < hole.shots.length; i++)
                ListTile(
                  dense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                  leading: CircleAvatar(radius: 14, child: Text('${i + 1}')),
                  title: Text(
                    '${Clubs.label(hole.shots[i].club)}'
                    '${hole.shots[i].distanceM == null ? '' : ' · ${Fmt.distance(hole.shots[i].distanceM, metric: settings.metric)}'}',
                  ),
                  subtitle: Text(
                    '${ShotResult.label(hole.shots[i].result)}'
                    '${hole.shots[i].start == null ? ' · no GPS' : ''}',
                  ),
                  trailing: const Icon(Icons.more_vert),
                  onTap: () => _editShot(i),
                ),
              const SizedBox(height: 4),
              Text(
                'Where did shot ${hole.shots.length} finish?',
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final r in ShotResult.all)
                    ChoiceChip(
                      label: Text(ShotResult.label(r)),
                      selected: hole.shots.last.result == r,
                      onSelected: (sel) => _setResult(hole.shots.length - 1, sel ? r : null),
                    ),
                ],
              ),
            ],

            // Fairway and green in regulation
            if (hole.played) ...[
              const SizedBox(height: 16),
              if (hole.fairwayPossible)
                _YesNoRow(
                  label: 'Fairway hit',
                  value: hole.fairwayHit,
                  onChanged: (v) {
                    setState(() => hole.fairwayHitOverride = v);
                    _save();
                  },
                ),
              _YesNoRow(
                label: 'Green in regulation',
                value: hole.greenInRegulation,
                onChanged: (v) {
                  setState(() => hole.girOverride = v);
                  _save();
                },
              ),
            ],

            // Scorecard
            const SizedBox(height: 16),
            Text('Scorecard', style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            ScorecardTable(
              holes: _round.holes,
              currentIndex: _index,
              onTapHole: _goTo,
              showTeeClub: false,
            ),
          ],
        ),
      ),
    );
  }
}

class _BigButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled;

  const _BigButton({required this.label, required this.icon, this.onPressed, this.filled = false});

  @override
  Widget build(BuildContext context) {
    final child = Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 26),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        ],
      ),
    );
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
    return filled
        ? FilledButton(onPressed: onPressed, style: FilledButton.styleFrom(shape: shape), child: child)
        : OutlinedButton(onPressed: onPressed, style: OutlinedButton.styleFrom(shape: shape), child: child);
  }
}

class _YesNoRow extends StatelessWidget {
  final String label;
  final bool? value;
  final ValueChanged<bool> onChanged;

  const _YesNoRow({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyLarge)),
          ChoiceChip(
            label: const Text('Yes'),
            selected: value == true,
            onSelected: (_) => onChanged(true),
          ),
          const SizedBox(width: 6),
          ChoiceChip(
            label: const Text('No'),
            selected: value == false,
            onSelected: (_) => onChanged(false),
          ),
        ],
      ),
    );
  }
}
