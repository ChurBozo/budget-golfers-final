import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Map pin images drawn on a canvas, ported from the old map page:
/// a red pin for the target and an orange pin for where the ball landed.
class PinImages {
  PinImages._();

  static Uint8List? _target;
  static Uint8List? _ball;

  static Future<Uint8List> target() async =>
      _target ??= await _pin(const Color(0xFFD32F2F), size: 56, body: 0.75, ring: 0.9);

  static Future<Uint8List> ball() async =>
      _ball ??= await _pin(const Color(0xFFFF9800), size: 52, body: 0.70, ring: 0.85);

  static Future<Uint8List> _pin(
    Color fill, {
    required double size,
    required double body,
    required double ring,
  }) async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final r = size / 2;
    final centre = Offset(r, r - 6);
    canvas.drawCircle(centre + const Offset(0, 2), r * ring, Paint()..color = const Color(0x33000000));
    canvas.drawCircle(centre, r * ring, Paint()..color = Colors.white);
    final paintFill = Paint()..color = fill;
    canvas.drawCircle(centre, r * body, paintFill);
    final tip = Path()
      ..moveTo(centre.dx, centre.dy + r * ring)
      ..lineTo(centre.dx - r * 0.2, centre.dy + r * 0.55)
      ..lineTo(centre.dx + r * 0.2, centre.dy + r * 0.55)
      ..close();
    canvas.drawPath(tip, paintFill);
    final picture = recorder.endRecording();
    final image = await picture.toImage(size.toInt(), size.toInt());
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  }
}
