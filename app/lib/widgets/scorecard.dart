import 'package:flutter/material.dart';

import '../models/clubs.dart';
import '../models/hole.dart';
import '../theme.dart';
import 'score_mark.dart';

/// Hole-by-hole scorecard in blocks of nine, like the website's Round detail
/// view. Tapping a hole calls [onTapHole] with its index in [holes].
class ScorecardTable extends StatelessWidget {
  final List<HoleScore> holes;
  final int? currentIndex;
  final ValueChanged<int>? onTapHole;
  final bool showPutts;
  final bool showTeeClub;

  const ScorecardTable({
    super.key,
    required this.holes,
    this.currentIndex,
    this.onTapHole,
    this.showPutts = true,
    this.showTeeClub = true,
  });

  @override
  Widget build(BuildContext context) {
    final blocks = <Widget>[];
    for (var start = 0; start < holes.length; start += 9) {
      final end = (start + 9 < holes.length) ? start + 9 : holes.length;
      if (blocks.isNotEmpty) blocks.add(const SizedBox(height: 12));
      blocks.add(_block(context, start, end));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: blocks);
  }

  Widget _block(BuildContext context, int start, int end) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final slice = holes.sublist(start, end);
    final totalLabel = slice.first.number >= 10 ? 'IN' : 'OUT';
    final labelStyle = theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700);
    final cellStyle = theme.textTheme.bodyMedium;
    final boldStyle = cellStyle?.copyWith(fontWeight: FontWeight.w800);
    final lineColour = dark ? Colors.white12 : Colors.black12;

    final parTotal = slice.fold<int>(0, (s, h) => s + h.par);
    final playedSlice = slice.where((h) => h.played).toList();
    final strokes = playedSlice.fold<int>(0, (s, h) => s + h.strokes);
    final putts = playedSlice.fold<int>(0, (s, h) => s + h.putts);

    Widget cell(Widget child, {int? index}) {
      final selected = index != null && index == currentIndex;
      final content = Container(
        height: 38,
        alignment: Alignment.center,
        color: selected ? Palette.turquoise.withValues(alpha: dark ? 0.25 : 0.35) : null,
        child: child,
      );
      if (index == null || onTapHole == null) return content;
      return InkWell(onTap: () => onTapHole!(index), child: content);
    }

    Widget label(String text) => Container(
          height: 38,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.only(left: 8),
          child: Text(text, style: labelStyle),
        );

    final rows = <TableRow>[
      TableRow(
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: lineColour, width: 2))),
        children: [
          label('Hole'),
          for (var i = 0; i < slice.length; i++)
            cell(Text('${slice[i].number}', style: labelStyle), index: start + i),
          cell(Text(totalLabel, style: labelStyle)),
        ],
      ),
      TableRow(
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: lineColour))),
        children: [
          label('Par'),
          for (var i = 0; i < slice.length; i++)
            cell(Text('${slice[i].par}', style: cellStyle), index: start + i),
          cell(Text('$parTotal', style: boldStyle)),
        ],
      ),
      TableRow(
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: lineColour))),
        children: [
          label('Score'),
          for (var i = 0; i < slice.length; i++)
            cell(ScoreMark(strokes: slice[i].strokes, par: slice[i].par, size: 28), index: start + i),
          cell(Text(playedSlice.isEmpty ? '–' : '$strokes', style: boldStyle)),
        ],
      ),
      if (showPutts)
        TableRow(
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: lineColour))),
          children: [
            label('Putts'),
            for (var i = 0; i < slice.length; i++)
              cell(Text(slice[i].played ? '${slice[i].putts}' : '–', style: cellStyle), index: start + i),
            cell(Text(playedSlice.isEmpty ? '–' : '$putts', style: boldStyle)),
          ],
        ),
      if (showTeeClub)
        TableRow(
          children: [
            label('Tee club'),
            for (var i = 0; i < slice.length; i++)
              cell(Text(Clubs.short(slice[i].teeClub).replaceAll('—', ''), style: cellStyle),
                  index: start + i),
            cell(const SizedBox.shrink()),
          ],
        ),
    ];

    final widths = <int, TableColumnWidth>{
      0: const FixedColumnWidth(72),
      for (var i = 1; i <= slice.length; i++) i: const FixedColumnWidth(40),
      slice.length + 1: const FixedColumnWidth(48),
    };

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Table(
        columnWidths: widths,
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        children: rows,
      ),
    );
  }
}
