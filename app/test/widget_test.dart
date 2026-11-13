// Widget tests that need no plugins (no database, GPS or Mapbox).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:golfapp/models/hole.dart';
import 'package:golfapp/models/shot.dart';
import 'package:golfapp/widgets/score_mark.dart';
import 'package:golfapp/widgets/scorecard.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

void main() {
  testWidgets('a birdie is drawn in a circle and a bogey in a square', (tester) async {
    await tester.pumpWidget(_wrap(const Row(children: [
      ScoreMark(strokes: 3, par: 4),
      ScoreMark(strokes: 5, par: 4),
    ])));

    final boxes = tester.widgetList<Container>(find.byType(Container)).toList();
    final shapes = boxes
        .map((c) => c.decoration)
        .whereType<BoxDecoration>()
        .map((d) => d.shape)
        .toList();
    expect(shapes, contains(BoxShape.circle));
    expect(shapes, contains(BoxShape.rectangle));
    expect(find.text('3'), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('scorecard shows an OUT total for the front nine', (tester) async {
    final holes = List.generate(9, (i) {
      final h = HoleScore(number: i + 1, par: 4);
      // Two full shots and two putts: a par on every hole.
      h.addShot(Shot(id: '${i}a', ts: DateTime(2026)));
      h.addShot(Shot(id: '${i}b', ts: DateTime(2026)));
      h.addPutt();
      h.addPutt();
      return h;
    });
    await tester.pumpWidget(_wrap(ScorecardTable(holes: holes)));

    expect(find.text('OUT'), findsOneWidget);
    expect(find.text('36'), findsNWidgets(2)); // par total and score total
    expect(find.text('18'), findsOneWidget); // putts total
  });
}
