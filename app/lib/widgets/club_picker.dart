import 'package:flutter/material.dart';

import '../models/clubs.dart';
import '../theme.dart';
import '../util/format.dart';

/// Bottom sheet for choosing the club for the next shot. Shows each club's
/// distance and highlights the suggested club. Returns the chosen code.
Future<String?> showClubPicker(
  BuildContext context, {
  required List<BagClub> bag,
  required Map<String, double> distances,
  required bool metric,
  String? current,
  String? suggested,
  double? targetMetres,
}) {
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      final theme = Theme.of(context);
      final clubs = bag.where((b) => b.inBag).toList();
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: Text('Choose a club', style: theme.textTheme.titleLarge),
              ),
              if (suggested != null && targetMetres != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                  child: Text(
                    'Suggested for ${Fmt.distance(targetMetres, metric: metric)}: ${Clubs.label(suggested)}',
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              if (clubs.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('Your bag is empty. Add clubs under Profile > Clubs.'),
                ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final b in clubs)
                      ListTile(
                        leading: CircleAvatar(
                          backgroundColor: b.code == suggested
                              ? Palette.bottleGreen
                              : theme.colorScheme.surfaceContainerHighest,
                          foregroundColor: b.code == suggested ? Colors.white : null,
                          child: Text(Clubs.short(b.code), style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        title: Text(b.label),
                        subtitle: Text(
                          distances[b.code] == null
                              ? 'No distance yet'
                              : 'Average ${Fmt.distance(distances[b.code], metric: metric)}',
                        ),
                        trailing: b.code == current ? const Icon(Icons.check_circle) : null,
                        onTap: () => Navigator.pop(context, b.code),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
