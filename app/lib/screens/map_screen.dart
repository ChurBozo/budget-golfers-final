import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' as mb;

import '../app.dart';
import '../config.dart';
import '../models/club_stats.dart';
import '../models/clubs.dart';
import '../models/geo.dart';
import '../models/shot.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/location.dart';
import '../widgets/club_picker.dart';
import '../widgets/pin_images.dart';

/// What the map hands back to the scoring screen.
class MapResult {
  /// Red target pin for the next shot.
  final LatLng? aim;

  /// Orange pin: where the last shot on this hole landed.
  final LatLng? landed;

  /// True when the golfer pressed "Hit shot from here".
  final bool hitShot;
  final LatLng? shotStart;
  final String? club;

  const MapResult({this.aim, this.landed, this.hitShot = false, this.shotStart, this.club});
}

/// Shot map, ported from the old `MapPage`: a red target pin to aim at and an
/// orange ball pin for where the last shot landed, on satellite imagery.
/// Tap the map to aim, long-press to mark the ball, drag either pin to adjust.
class MapScreen extends StatefulWidget {
  final int holeNumber;
  final int par;
  final LatLng? aim;
  final Shot? lastShot;
  final List<BagClub> bag;
  final Map<String, double> distances;

  const MapScreen({
    super.key,
    required this.holeNumber,
    required this.par,
    required this.bag,
    required this.distances,
    this.aim,
    this.lastShot,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  mb.MapboxMap? _map;
  mb.PointAnnotationManager? _points;
  mb.PolylineAnnotationManager? _lines;
  mb.PointAnnotation? _aimPin;
  mb.PointAnnotation? _ballPin;
  mb.Cancelable? _dragEvents;

  LatLng? _me;
  LatLng? _aim;
  LatLng? _ball;
  String? _club;

  @override
  void initState() {
    super.initState();
    _aim = widget.aim;
    _ball = widget.lastShot?.end;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _club ??= AppScope.read(context).currentClub;
  }

  @override
  void dispose() {
    _dragEvents?.cancel();
    super.dispose();
  }

  static mb.Point _pt(LatLng p) => mb.Point(coordinates: mb.Position(p.lng, p.lat));

  static LatLng _ll(mb.Point p) => LatLng.fromLngLat(p.coordinates.lng, p.coordinates.lat);

  double? get _toAimM => (_me != null && _aim != null) ? Geo.distanceM(_me!, _aim!) : null;

  /// Distance of the last shot: where it was hit from to the orange pin.
  double? get _lastShotM {
    final start = widget.lastShot?.start;
    if (start == null || _ball == null) return null;
    return Geo.distanceM(start, _ball!);
  }

  String? get _suggested {
    final d = _toAimM;
    if (d == null) return null;
    return ClubStats.suggest(d, widget.distances);
  }

  Future<void> _onMapCreated(mb.MapboxMap map) async {
    _map = map;
    await map.location.updateSettings(mb.LocationComponentSettings(
      enabled: true,
      pulsingEnabled: true,
      puckBearingEnabled: true,
      puckBearing: mb.PuckBearing.COURSE,
    ));
    await map.gestures.updateSettings(mb.GesturesSettings(
      rotateEnabled: true,
      pinchToZoomEnabled: true,
      scrollEnabled: true,
      pitchEnabled: false,
    ));
    _points = await map.annotations.createPointAnnotationManager();
    _lines = await map.annotations.createPolylineAnnotationManager();
    _dragEvents = _points!.dragEvents(
      onChanged: (a) => _onDrag(a, finished: false),
      onEnd: (a) => _onDrag(a, finished: true),
    );

    if (_aim != null) await _placeAim(_aim!);
    if (_ball != null) await _placeBall(_ball!);

    final me = await LocationService.current();
    if (!mounted) return;
    setState(() => _me = me);
    final centre = _aim ?? me ?? _ball;
    if (centre != null) {
      await map.flyTo(
        mb.CameraOptions(center: _pt(centre), zoom: 16.5, bearing: 0, pitch: 0),
        mb.MapAnimationOptions(duration: 800),
      );
    }
    await _redrawAimLine();
  }

  Future<void> _placeAim(LatLng p) async {
    final points = _points;
    if (points == null) return;
    final pin = _aimPin;
    if (pin == null) {
      _aimPin = await points.create(mb.PointAnnotationOptions(
        geometry: _pt(p),
        image: await PinImages.target(),
        iconAnchor: mb.IconAnchor.BOTTOM,
        isDraggable: true,
      ));
    } else {
      pin.geometry = _pt(p);
      await points.update(pin);
    }
  }

  Future<void> _placeBall(LatLng p) async {
    final points = _points;
    if (points == null) return;
    final pin = _ballPin;
    if (pin == null) {
      _ballPin = await points.create(mb.PointAnnotationOptions(
        geometry: _pt(p),
        image: await PinImages.ball(),
        iconAnchor: mb.IconAnchor.BOTTOM,
        isDraggable: true,
      ));
    } else {
      pin.geometry = _pt(p);
      await points.update(pin);
    }
  }

  Future<void> _redrawAimLine() async {
    final lines = _lines;
    if (lines == null) return;
    await lines.deleteAll();
    final me = _me;
    final aim = _aim;
    if (me == null || aim == null) return;
    await lines.create(mb.PolylineAnnotationOptions(
      geometry: mb.LineString(coordinates: [
        mb.Position(me.lng, me.lat),
        mb.Position(aim.lng, aim.lat),
      ]),
      lineColor: Colors.white.toARGB32(),
      lineWidth: 2.5,
      lineOpacity: 0.85,
    ));
  }

  void _onDrag(mb.PointAnnotation a, {required bool finished}) {
    if (!mounted) return;
    if (a.id == _aimPin?.id) {
      setState(() => _aim = _ll(a.geometry));
      if (finished) _redrawAimLine();
    } else if (a.id == _ballPin?.id) {
      setState(() => _ball = _ll(a.geometry));
    }
  }

  Future<void> _setAim(LatLng p) async {
    setState(() => _aim = p);
    await _placeAim(p);
    await _redrawAimLine();
  }

  Future<void> _setBall(LatLng p) async {
    if (widget.lastShot == null) {
      _snack('Record a shot first, then mark where it landed.');
      return;
    }
    setState(() => _ball = p);
    await _placeBall(p);
  }

  Future<void> _ballHere() async {
    final me = await LocationService.current();
    if (!mounted) return;
    if (me == null) {
      _snack('Unable to get your GPS position.');
      return;
    }
    setState(() => _me = me);
    await _setBall(me);
  }

  Future<void> _recentre() async {
    final me = await LocationService.current();
    if (!mounted) return;
    if (me == null) {
      _snack('Unable to get your GPS position.');
      return;
    }
    setState(() => _me = me);
    await _map?.flyTo(
      mb.CameraOptions(center: _pt(me), zoom: 17, bearing: 0, pitch: 0),
      mb.MapAnimationOptions(duration: 700),
    );
    await _redrawAimLine();
  }

  Future<void> _zoomBy(double delta) async {
    final map = _map;
    if (map == null) return;
    final cam = await map.getCameraState();
    await map.flyTo(
      mb.CameraOptions(zoom: cam.zoom + delta),
      mb.MapAnimationOptions(duration: 220),
    );
  }

  Future<void> _chooseClub() async {
    final settings = AppScope.read(context);
    final code = await showClubPicker(
      context,
      bag: widget.bag,
      distances: widget.distances,
      metric: settings.metric,
      current: _club,
      suggested: _suggested,
      targetMetres: _toAimM,
    );
    if (code == null || !mounted) return;
    setState(() => _club = code);
    await settings.setCurrentClub(code);
  }

  Future<void> _hitShot() async {
    final me = await LocationService.current() ?? _me;
    if (!mounted) return;
    Navigator.pop(
      context,
      MapResult(aim: _aim, landed: _ball, hitShot: true, shotStart: me, club: _club),
    );
  }

  void _done() {
    Navigator.pop(context, MapResult(aim: _aim, landed: _ball, club: _club));
  }

  void _snack(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final metric = AppScope.of(context).metric;
    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _done();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: BackButton(onPressed: _done),
          title: Text('Hole ${widget.holeNumber} · Par ${widget.par}'),
          actions: [
            IconButton(
              tooltip: 'Centre on me',
              icon: const Icon(Icons.my_location),
              onPressed: AppConfig.hasMapboxToken ? _recentre : null,
            ),
          ],
        ),
        body: AppConfig.hasMapboxToken ? _mapBody(metric) : const _NoTokenMessage(),
      ),
    );
  }

  Widget _mapBody(bool metric) {
    final theme = Theme.of(context);
    final toAim = _toAimM;
    final suggested = _suggested;
    final chips = <String>[
      if (toAim != null) 'Target ${Fmt.distance(toAim, metric: metric)}',
      if (suggested != null) 'Suggest ${Clubs.short(suggested)}',
      if (_lastShotM != null) 'Last shot ${Fmt.distance(_lastShotM, metric: metric)}',
    ];
    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              mb.MapWidget(
                key: const ValueKey('shot-map'),
                styleUri: mb.MapboxStyles.SATELLITE_STREETS,
                onMapCreated: _onMapCreated,
                onTapListener: (ctx) => _setAim(_ll(ctx.point)),
                onLongTapListener: (ctx) => _setBall(_ll(ctx.point)),
              ),
              if (chips.isNotEmpty)
                Positioned(
                  top: 12,
                  left: 12,
                  right: 12,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        chips.join('  ·  '),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ),
              Positioned(
                right: 12,
                bottom: 16,
                child: Column(
                  children: [
                    FloatingActionButton.small(
                      heroTag: 'zoom-in',
                      onPressed: () => _zoomBy(0.75),
                      child: const Icon(Icons.zoom_in),
                    ),
                    const SizedBox(height: 8),
                    FloatingActionButton.small(
                      heroTag: 'zoom-out',
                      onPressed: () => _zoomBy(-0.75),
                      child: const Icon(Icons.zoom_out),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Material(
          elevation: 8,
          color: theme.colorScheme.surface,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Tap the map to aim (red). Long-press, or "Ball is here", to mark where your last shot landed (orange).',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _chooseClub,
                          icon: const Icon(Icons.sports_golf),
                          label: Text(_club == null ? 'Choose club' : Clubs.label(_club)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: widget.lastShot == null ? null : _ballHere,
                          icon: const Icon(Icons.place, color: Palette.ballPin),
                          label: const Text('Ball is here'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(onPressed: _done, child: const Text('Save and close')),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _hitShot,
                          icon: const Icon(Icons.add),
                          label: const Text('Hit shot from here'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _NoTokenMessage extends StatelessWidget {
  const _NoTokenMessage();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.map_outlined, size: 48),
            const SizedBox(height: 12),
            Text('The map needs a Mapbox token', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text(
              'Put your public token (pk.…) in config/mapbox.json and run the app with '
              '--dart-define-from-file=config/mapbox.json. See the README. '
              'Scoring still works without the map.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
