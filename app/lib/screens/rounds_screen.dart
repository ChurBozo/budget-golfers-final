import 'package:flutter/material.dart';

import '../data/round_repository.dart';
import '../models/round.dart';
import '../services.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/upload_card.dart';
import 'round_detail_screen.dart';

/// Past rounds, newest first, each with its upload state.
class RoundsScreen extends StatefulWidget {
  const RoundsScreen({super.key});

  @override
  State<RoundsScreen> createState() => _RoundsScreenState();
}

class _RoundsScreenState extends State<RoundsScreen> {
  List<Round>? _rounds;

  @override
  void initState() {
    super.initState();
    Services.uploads.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    Services.uploads.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    final rounds = await RoundRepository.instance.finishedRounds();
    if (mounted) setState(() => _rounds = rounds);
  }

  Future<void> _open(Round r) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => RoundDetailScreen(round: r)),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final rounds = _rounds;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Past rounds'),
        actions: [
          ListenableBuilder(
            listenable: Services.uploads,
            builder: (context, _) => IconButton(
              tooltip: 'Upload now',
              onPressed: Services.uploads.busy ? null : () => uploadNow(context),
              icon: Services.uploads.busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.cloud_upload),
            ),
          ),
        ],
      ),
      body: rounds == null
          ? const Center(child: CircularProgressIndicator())
          : rounds.isEmpty
              ? const _EmptyRounds()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    itemCount: rounds.length,
                    itemBuilder: (context, i) => _RoundRow(round: rounds[i], onTap: () => _open(rounds[i])),
                  ),
                ),
    );
  }
}

class _RoundRow extends StatelessWidget {
  final Round round;
  final VoidCallback onTap;

  const _RoundRow({required this.round, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = round.totals;
    final dark = theme.brightness == Brightness.dark;
    final subtitle = [
      '${round.holesPlayed} holes',
      if (round.tee != null) '${round.tee} tees',
    ].join(' · ');
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 54,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Palette.lightCyan.withValues(alpha: dark ? 0.1 : 1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Text(
                      round.playedAt.day.toString().padLeft(2, '0'),
                      style: theme.textTheme.titleLarge?.copyWith(color: dark ? Palette.turquoise : Palette.bottleGreen),
                    ),
                    Text(Fmt.monthShort(round.playedAt).toUpperCase(), style: theme.textTheme.labelSmall),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(round.courseName, style: theme.textTheme.titleMedium),
                    Text(subtitle, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              _SyncIcon(status: round.syncStatus),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Palette.turquoise.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(Fmt.toPar(t.toPar), style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 8),
              Text('${t.strokes}', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SyncIcon extends StatelessWidget {
  final String status;

  const _SyncIcon({required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case SyncStatus.synced:
        return const Tooltip(message: 'Uploaded', child: Icon(Icons.cloud_done, color: Palette.bottleGreen));
      case SyncStatus.failed:
        return const Tooltip(message: 'Upload failed', child: Icon(Icons.cloud_off, color: Palette.flagRed));
      default:
        return Tooltip(
          message: 'Waiting to upload',
          child: Icon(Icons.cloud_upload_outlined, color: Theme.of(context).colorScheme.outline),
        );
    }
  }
}

class _EmptyRounds extends StatelessWidget {
  const _EmptyRounds();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Text(
          'No rounds yet. Start one from New Round on the home screen.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
