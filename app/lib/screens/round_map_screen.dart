import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' as mb;

import '../app.dart';
import '../config.dart';
import '../models/clubs.dart';
import '../models/hole.dart';
import '../models/round.dart';
import '../util/format.dart';

/// Every recorded shot drawn on the map, ported from the old
/// `RoundShotsMapPage`. Pick a hole to zoom in on it.
class RoundMapScreen extends StatefulWidget {
  final Round round;

  const RoundMapScreen({super.key, required this.round});

  @override
  State<RoundMapScreen> createState() => _RoundMapScreenState();
}

class _RoundMapScreenState extends State<RoundMapScreen> {
  mb.MapboxMap? _map;
  mb.PointAnnotationManager? _labels;
  mb.PolylineAnnotationManager? _lines;
  mb.CircleAnnotationManager? _dots;
  int? _holeFilter; // null = every hole

  List<HoleScore> get _holesWithShots =>
      widget.round.holes.where((h) => h.shots.any((s) => s.start != null && s.end != null)).toList();

  Future<void> _onMapCreated(mb.MapboxMap map) async {
    _map = map;
    _lines = await map.annotations.createPolylineAnnotationManager();
    _dots = await map.annotations.createCircleAnnotationManager();
    _labels = await map.annotations.createPointAnnotationManager();
    await _render();
  }

  Future<void> _render() async {
    final map = _map;
    final lines = _lines;
    final dots = _dots;
    final labels = _labels;
    if (map == null || lines == null || dots == null || labels == null || !mounted) return;
    final metric = AppScope.read(context).metric;

    await lines.deleteAll();
    await dots.deleteAll();
    await labels.deleteAll();

    final bounds = <mb.Point>[];
    for (final h in widget.round.holes) {
      if (_holeFilter != null && h.number != _holeFilter) continue;
      for (var i = 0; i < h.shots.length; i++) {
        final s = h.shots[i];
        final start = s.start;
        final end = s.end;
        if (start == null || end == null) continue;
        final a = mb.Position(start.lng, start.lat);
        final b = mb.Position(end.lng, end.lat);
        await lines.create(mb.PolylineAnnotationOptions(
          geometry: mb.LineString(coordinates: [a, b]),
          lineColor: Colors.white.toARGB32(),
          lineWidth: 3.0,
          lineOpacity: 0.9,
        ));
        await dots.create(mb.CircleAnnotationOptions(
          geometry: mb.Point(coordinates: b),
          circleColor: const Color(0xFFFF9800).toARGB32(),
          circleRadius: 5.0,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 1.5,
        ));
        final target = s.target;
        if (target != null) {
          await dots.create(mb.CircleAnnotationOptions(
            geometry: mb.Point(coordinates: mb.Position(target.lng, target.lat)),
            circleColor: const Color(0xFFD32F2F).toARGB32(),
            circleRadius: 3.5,
          ));
        }
        await labels.create(mb.PointAnnotationOptions(
          geometry: mb.Point(
            coordinates: mb.Position((start.lng + end.lng) / 2, (start.lat + end.lat) / 2),
          ),
          textField: 'H${h.number} · ${i + 1} · ${Clubs.short(s.club)} · '
              '${Fmt.distance(s.distanceM, metric: metric)}',
          textSize: 12.0,
          textColor: Colors.black.toARGB32(),
          textHaloColor: Colors.white.toARGB32(),
          textHaloWidth: 1.5,
        ));
        bounds
          ..add(mb.Point(coordinates: a))
          ..add(mb.Point(coordinates: b));
      }
    }

    if (bounds.isNotEmpty) {
      final camera = await map.cameraForCoordinatesPadding(
        bounds,
        mb.CameraOptions(bearing: 0, pitch: 0),
        mb.MbxEdgeInsets(top: 60, left: 40, bottom: 60, right: 40),
        18.0,
        null,
      );
      await map.flyTo(camera, mb.MapAnimationOptions(duration: 800));
    }
  }

  void _filter(int? hole) {
    setState(() => _holeFilter = hole);
    _render();
  }

  @override
  Widget build(BuildContext context) {
    final holes = _holesWithShots;
    return Scaffold(
      appBar: AppBar(title: Text('Shots · ${widget.round.courseName}')),
      body: !AppConfig.hasMapboxToken
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'The map needs a Mapbox token. See the README.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : Column(
              children: [
                SizedBox(
                  height: 52,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: ChoiceChip(
                          label: const Text('All holes'),
                          selected: _holeFilter == null,
                          onSelected: (_) => _filter(null),
                        ),
                      ),
                      for (final h in holes)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: ChoiceChip(
                            label: Text('Hole ${h.number}'),
                            selected: _holeFilter == h.number,
                            onSelected: (_) => _filter(h.number),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: mb.MapWidget(
                    key: const ValueKey('round-map'),
                    styleUri: mb.MapboxStyles.SATELLITE_STREETS,
                    onMapCreated: _onMapCreated,
                  ),
                ),
              ],
            ),
    );
  }
}
