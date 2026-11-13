import 'package:flutter/material.dart';

import '../theme.dart';

/// A score with the website's scorecard marks: a circle for birdie or
/// better, plain for par, a sand square for bogey and a red square for
/// double bogey or worse. Shape carries the meaning as well as colour.
class ScoreMark extends StatelessWidget {
  final int strokes;
  final int par;
  final double size;

  const ScoreMark({super.key, required this.strokes, required this.par, this.size = 30});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : Palette.fairwayDark;
    if (strokes <= 0) {
      return SizedBox(
        width: size,
        height: size,
        child: Center(child: Text('–', style: TextStyle(color: ink.withValues(alpha: 0.5)))),
      );
    }
    final diff = strokes - par;
    BoxDecoration? deco;
    Color textColour = ink;
    if (diff <= -2) {
      deco = BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Palette.bottleGreen, width: 3),
      );
    } else if (diff == -1) {
      deco = BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: dark ? Palette.turquoise : Palette.bottleGreen, width: 2),
      );
    } else if (diff == 1) {
      deco = BoxDecoration(
        color: Palette.sand,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFCDBB8E)),
      );
      textColour = Palette.fairwayDark;
    } else if (diff >= 2) {
      deco = BoxDecoration(
        color: Palette.flagRed.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Palette.flagRed, width: 2),
      );
      textColour = dark ? Colors.white : Palette.flagRed;
    }
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: deco,
      child: Text(
        '$strokes',
        style: TextStyle(fontWeight: FontWeight.w800, fontSize: size * 0.48, color: textColour),
      ),
    );
  }
}

/// Legend under a scorecard.
class ScoreLegend extends StatelessWidget {
  const ScoreLegend({super.key});

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall;
    Widget item(int strokes, String label) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScoreMark(strokes: strokes, par: 4, size: 22),
            const SizedBox(width: 4),
            Text(label, style: style),
          ],
        );
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        item(3, 'Birdie'),
        item(4, 'Par'),
        item(5, 'Bogey'),
        item(6, 'Double bogey or worse'),
      ],
    );
  }
}
