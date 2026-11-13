import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app.dart';
import '../data/round_repository.dart';
import '../models/clubs.dart';
import '../models/round.dart';
import '../models/shot.dart';
import '../services.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/score_mark.dart';
import '../widgets/scorecard.dart';
import '../widgets/stat_tile.dart';
import '../widgets/upload_card.dart';
import 'round_map_screen.dart';
import 'sign_in_screen.dart';

/// One finished round: totals, the scorecard and every shot, like the
/// website's Round detail view.
class RoundDetailScreen extends StatelessWidget {
  final Round round;

  const RoundDetailScreen({super.key, required this.round});

  Future<void> _delete(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this round?'),
        content: Text(
          round.syncStatus == SyncStatus.synced
              ? 'It will be removed from this phone. The uploaded copy stays on the website, '
                  'where you can delete it too.'
              : 'It will be removed from this phone. It has not been uploaded, so this cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.flagRed),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await RoundRepository.instance.delete(round.clientRoundId);
    if (context.mounted) Navigator.pop(context, true);
  }

  Future<void> _copyUploadJson(BuildContext context) async {
    final json = const JsonEncoder.withIndent('  ').convert(round.toApiJson());
    await Clipboard.setData(ClipboardData(text: json));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Upload JSON copied. Paste it into Postman to test POST /api/rounds.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final metric = AppScope.of(context).metric;
    final theme = Theme.of(context);
    final t = round.totals;
    final hasShots = round.allShots.any((s) => s.start != null);
    final details = [
      '${round.holesPlayed} holes',
      if (round.tee != null) '${round.tee} tees',
      'Par ${round.parTotal}',
    ].join(' · ');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Round'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'delete') _delete(context);
              if (v == 'json') _copyUploadJson(context);
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'json', child: Text('Copy upload JSON')),
              PopupMenuItem(value: 'delete', child: Text('Delete round')),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text('${round.courseName} · ${Fmt.date(round.playedAt)}', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(details, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 10),
          _UploadBanner(round: round),
          const SizedBox(height: 6),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.7,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
            children: [
              StatTile(label: 'Score', value: '${t.strokes}', suffix: '(${Fmt.toPar(t.toPar)})'),
              StatTile(label: 'Putts', value: '${t.putts}'),
              StatTile(label: 'Fairways', value: '${t.fairwaysHit}', suffix: '/${t.fairwaysPossible}'),
              StatTile(label: 'Greens in reg.', value: '${t.greensInRegulation}', suffix: '/${t.holesScored}'),
            ],
          ),
          SectionCard(
            title: 'Scorecard',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ScorecardTable(holes: round.holes),
                const SizedBox(height: 10),
                const ScoreLegend(),
              ],
            ),
          ),
          if (hasShots)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: FilledButton.tonalIcon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => RoundMapScreen(round: round)),
                ),
                icon: const Icon(Icons.map),
                label: const Text('Show shots on the map'),
              ),
            ),
          SectionCard(
            title: 'Shots',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final h in round.holes)
                  if (h.shots.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 44,
                            child: Column(
                              children: [
                                Text('H${h.number}', style: theme.textTheme.labelLarge),
                                ScoreMark(strokes: h.strokes, par: h.par, size: 24),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              [
                                for (var i = 0; i < h.shots.length; i++)
                                  _shotLine(i + 1, h.shots[i], metric),
                                if (h.putts > 0) '${h.putts} putt${h.putts == 1 ? '' : 's'}',
                                if (h.penalties > 0)
                                  '${h.penalties} penalt${h.penalties == 1 ? 'y' : 'ies'}',
                              ].join('\n'),
                            ),
                          ),
                        ],
                      ),
                    ),
                if (!round.holes.any((h) => h.shots.isNotEmpty))
                  const Text('No shots were marked in this round, only scores.'),
              ],
            ),
          ),
          if (round.notes != null)
            SectionCard(title: 'Notes', child: Text(round.notes!)),
        ],
      ),
    );
  }

  static String _shotLine(int seq, Shot s, bool metric) {
    final parts = <String>[
      '$seq. ${Clubs.label(s.club)}',
      if (s.distanceM != null) Fmt.distance(s.distanceM, metric: metric),
      if (s.result != null) ShotResult.label(s.result),
    ];
    return parts.join(' · ');
  }
}

/// Upload state of the round, with the action that fits: sign in, upload
/// now, or try again after the server refused it.
class _UploadBanner extends StatefulWidget {
  final Round round;

  const _UploadBanner({required this.round});

  @override
  State<_UploadBanner> createState() => _UploadBannerState();
}

class _UploadBannerState extends State<_UploadBanner> {
  late Round _round = widget.round;
  late final Listenable _changes = Listenable.merge([Services.account, Services.uploads]);

  @override
  void initState() {
    super.initState();
    _changes.addListener(_reload);
  }

  @override
  void dispose() {
    _changes.removeListener(_reload);
    super.dispose();
  }

  // The upload queue works on its own copy of the round, so read it again.
  Future<void> _reload() async {
    final fresh = await RoundRepository.instance.byId(_round.clientRoundId);
    if (fresh != null && mounted) setState(() => _round = fresh);
  }

  Future<void> _retry() async {
    final messenger = ScaffoldMessenger.of(context);
    final report = await Services.uploads.retry(_round);
    await _reload();
    if (!mounted) return;
    if (!Services.account.signedIn) {
      await Navigator.of(context).push(MaterialPageRoute<bool>(builder: (_) => const SignInScreen()));
      return;
    }
    messenger.showSnackBar(SnackBar(content: Text(report.summary)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final signedIn = Services.account.signedIn;
    final busy = Services.uploads.busy;
    late final IconData icon;
    late final String text;
    Widget? action;
    switch (_round.syncStatus) {
      case SyncStatus.synced:
        icon = Icons.cloud_done;
        final at = _round.syncedAt;
        text = 'Uploaded to your Budget Golfers account${at == null ? '' : ' on ${Fmt.dateTime(at)}'}. '
            'It is on the website with your stats.';
        break;
      case SyncStatus.failed:
        icon = Icons.cloud_off;
        text = 'The server could not store this round: ${_round.syncError ?? 'unknown reason'}.';
        action = TextButton(onPressed: busy ? null : _retry, child: const Text('Try again'));
        break;
      default:
        icon = Icons.cloud_upload_outlined;
        final owner = _round.ownerUserId;
        if (owner != null && owner != Services.account.account?.userId) {
          text = 'Saved on this phone for another account. Sign in with that account to upload it.';
        } else if (signedIn) {
          text = busy ? 'Uploading…' : 'Saved on this phone and waiting to upload.';
          action = TextButton(onPressed: busy ? null : () => uploadNow(context), child: const Text('Upload now'));
        } else {
          text = 'Saved on this phone. Sign in to upload it to the Budget Golfers website.';
          action = TextButton(onPressed: () => uploadNow(context), child: const Text('Sign in'));
        }
    }
    final failed = _round.syncStatus == SyncStatus.failed;
    final colour = failed ? Palette.flagRed : Palette.turquoise;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
      decoration: BoxDecoration(
        color: (failed ? Palette.flagRed : Palette.lightCyan)
            .withValues(alpha: theme.brightness == Brightness.dark ? 0.08 : (failed ? 0.06 : 0.7)),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colour),
      ),
      child: Row(
        children: [
          Icon(icon, color: failed ? Palette.flagRed : theme.colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: theme.textTheme.bodySmall)),
          if (action != null) action,
        ],
      ),
    );
  }
}
