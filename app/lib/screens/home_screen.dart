import 'package:flutter/material.dart';

import '../data/round_repository.dart';
import '../models/round.dart';
import '../services.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/upload_card.dart';
import 'help_screen.dart';
import 'new_round_screen.dart';
import 'profile_screen.dart';
import 'rounds_screen.dart';
import 'scoring_screen.dart';
import 'settings_screen.dart';

/// Home: the old app's card layout, plus a Resume card for an unfinished round.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Round? _active;
  int _pending = 0;

  @override
  void initState() {
    super.initState();
    // Background uploads change the "waiting to upload" count.
    Services.uploads.addListener(_refresh);
    _refresh();
  }

  @override
  void dispose() {
    Services.uploads.removeListener(_refresh);
    super.dispose();
  }

  Future<void> _refresh() async {
    final active = await RoundRepository.instance.activeRound();
    final pending = await RoundRepository.instance.pendingUploads();
    if (!mounted) return;
    setState(() {
      _active = active;
      _pending = pending.length;
    });
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
    await _refresh();
  }

  Future<void> _newRound() async {
    final active = _active;
    if (active != null) {
      final choice = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Unfinished round'),
          content: Text(
            'You have an unfinished round at ${active.courseName}. '
            'Resume it, or delete it and start a new one?',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(context, 'discard'),
              child: const Text('Delete and start new'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, 'resume'),
              child: const Text('Resume'),
            ),
          ],
        ),
      );
      if (!mounted || choice == null) return;
      if (choice == 'resume') {
        await _open(ScoringScreen(round: active));
        return;
      }
      await RoundRepository.instance.delete(active.clientRoundId);
      if (!mounted) return;
    }
    await _open(const NewRoundScreen());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = _active;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/logoFinal.png', height: 30),
            const SizedBox(width: 10),
            const Text('Budget Golfers'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (active != null)
              Card(
                color: Palette.bottleGreen,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  leading: const Icon(Icons.play_circle_fill, color: Colors.white, size: 36),
                  title: const Text(
                    'Resume round',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                  subtitle: Text(
                    '${active.courseName} · hole ${active.holes[active.currentHoleIndex.clamp(0, active.holes.length - 1)].number}'
                    ' · ${Fmt.toPar(active.totals.toPar)} after ${active.totals.holesScored}',
                    style: const TextStyle(color: Colors.white70),
                  ),
                  trailing: const Icon(Icons.chevron_right, color: Colors.white),
                  onTap: () => _open(ScoringScreen(round: active)),
                ),
              ),
            _HomeCard(
              icon: Icons.golf_course,
              title: 'New Round',
              subtitle: 'Start scoring',
              onTap: _newRound,
            ),
            _HomeCard(
              icon: Icons.history,
              title: 'Past Rounds',
              subtitle: _pending == 0
                  ? 'Review your games'
                  : 'Review your games · $_pending waiting to upload',
              onTap: () => _open(const RoundsScreen()),
            ),
            _HomeCard(
              icon: Icons.person,
              title: 'Profile',
              subtitle: 'Clubs, performance and accuracy',
              onTap: () => _open(const ProfileScreen()),
            ),
            _HomeCard(
              icon: Icons.settings,
              title: 'Settings',
              subtitle: 'Theme, units and account',
              onTap: () => _open(const SettingsScreen()),
            ),
            _HomeCard(
              icon: Icons.help_outline,
              title: 'Help',
              subtitle: 'How to record a round',
              onTap: () => _open(const HelpScreen()),
            ),
            const UploadCard(),
            const SizedBox(height: 12),
            Text(
              'No account needed to play. Your rounds are saved on this phone, '
              'and you only sign in to upload them.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _HomeCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        leading: Icon(icon, color: theme.colorScheme.primary, size: 30),
        title: Text(title, style: theme.textTheme.titleLarge),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
