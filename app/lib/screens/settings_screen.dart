import 'package:flutter/material.dart';

import '../app.dart';
import '../config.dart';
import '../data/api_client.dart';
import '../data/round_repository.dart';
import '../services.dart';
import '../theme.dart';
import '../widgets/controller_dialog.dart';
import '../widgets/stat_tile.dart';
import '../widgets/upload_card.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _deleteAll(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete every round?'),
        content: const Text(
          'All rounds on this phone, including any not uploaded yet, will be deleted. '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.flagRed),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete all'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await RoundRepository.instance.deleteAll();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('All rounds deleted.')));
  }

  @override
  Widget build(BuildContext context) {
    final settings = AppScope.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: 'Theme',
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'light', label: Text('Light'), icon: Icon(Icons.light_mode)),
                ButtonSegment(value: 'dark', label: Text('Dark'), icon: Icon(Icons.dark_mode)),
                ButtonSegment(value: 'system', label: Text('System')),
              ],
              selected: {settings.theme},
              onSelectionChanged: (s) => settings.setTheme(s.first),
            ),
          ),
          SectionCard(
            title: 'Units',
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'metric', label: Text('Metres')),
                ButtonSegment(value: 'imperial', label: Text('Yards')),
              ],
              selected: {settings.units},
              onSelectionChanged: (s) => settings.setUnits(s.first),
            ),
          ),
          SectionCard(
            title: 'Map',
            child: Row(
              children: [
                Icon(
                  AppConfig.hasMapboxToken ? Icons.check_circle : Icons.error_outline,
                  color: AppConfig.hasMapboxToken ? Palette.bottleGreen : Palette.flagRed,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    AppConfig.hasMapboxToken
                        ? 'Mapbox token found. The shot map is ready.'
                        : 'No Mapbox token. Scoring works, but the map needs config/mapbox.json (see the README).',
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 2, left: 4),
            child: Text('Account', style: theme.textTheme.titleMedium),
          ),
          const UploadCard(detailed: true),
          const _DownloadCard(),
          const _ServerCard(),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => _deleteAll(context),
            icon: const Icon(Icons.delete_forever, color: Palette.flagRed),
            label: const Text('Delete all rounds on this phone'),
          ),
        ],
      ),
    );
  }
}

/// "Download my rounds": copies the rounds on the signed-in account (from the
/// website or another phone) onto this phone. Rounds already here are skipped.
class _DownloadCard extends StatelessWidget {
  const _DownloadCard();

  Future<void> _download(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final report = await Services.downloads.downloadMine();
    messenger.showSnackBar(SnackBar(content: Text(report.summary)));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([Services.account, Services.downloads]),
      builder: (context, _) {
        final signedIn = Services.account.signedIn;
        final busy = Services.downloads.busy;
        return SectionCard(
          title: 'Rounds on your account',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                signedIn
                    ? 'Copy the rounds saved to your account, for example ones uploaded from another phone, '
                        'onto this phone. Rounds already here are skipped.'
                    : 'Sign in above to download the rounds saved to your account.',
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: signedIn && !busy ? () => _download(context) : null,
                icon: busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.cloud_download),
                label: Text(busy ? 'Downloading…' : 'Download my rounds'),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Where rounds are uploaded. The default comes from API_BASE_URL at build
/// time; changing it here helps when testing on a phone against a computer
/// on the same Wi-Fi (for example http://192.168.1.20:3000).
///
/// "Wake up" is for the free Render server, which sleeps after 15 minutes
/// without traffic and takes about a minute to start again.
class _ServerCard extends StatefulWidget {
  const _ServerCard();

  @override
  State<_ServerCard> createState() => _ServerCardState();
}

class _ServerCardState extends State<_ServerCard> {
  bool _waking = false;

  Future<void> _wake(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _waking = true);
    messenger.showSnackBar(const SnackBar(
      content: Text('Waking the server. On the free plan this can take up to a minute…'),
      duration: Duration(seconds: 90),
    ));
    final watch = Stopwatch()..start();
    String message;
    try {
      await Services.account.api.health(wait: const Duration(seconds: 90));
      final seconds = watch.elapsed.inSeconds;
      message = seconds < 3 ? 'The server is already awake.' : 'The server is awake. It took $seconds seconds.';
    } on ApiException catch (e) {
      message = 'The server did not wake up: ${e.message}';
    }
    if (!mounted) return;
    setState(() => _waking = false);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _edit(BuildContext context) async {
    final value = await showDialog<String>(
      context: context,
      builder: (context) => ControllerDialog(
        initialText: Services.account.baseUrl,
        builder: (context, controller) => AlertDialog(
          title: const Text('Server address'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: controller,
                keyboardType: TextInputType.url,
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'API address', hintText: 'https://…'),
              ),
              const SizedBox(height: 8),
              const Text('Changing the server signs you out on this phone.'),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, AppConfig.defaultApiBaseUrl), child: const Text('Reset')),
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (value == null) return;
    final uri = Uri.tryParse(value.trim());
    if (uri == null || !(uri.isScheme('http') || uri.isScheme('https')) || uri.host.isEmpty) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a full address starting with http:// or https://')),
      );
      return;
    }
    await Services.account.setBaseUrl(value);
  }

  Future<void> _check(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    String message;
    try {
      await Services.account.api.health();
      message = 'Connected to ${Services.account.baseUrl}.';
    } on ApiException catch (e) {
      message = e.message;
    }
    messenger.showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Services.account,
      builder: (context, _) => SectionCard(
        title: 'Server',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(Services.account.baseUrl, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                OutlinedButton.icon(onPressed: () => _check(context), icon: const Icon(Icons.wifi_tethering), label: const Text('Check')),
                OutlinedButton.icon(
                  onPressed: _waking ? null : () => _wake(context),
                  icon: _waking
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.alarm),
                  label: Text(_waking ? 'Waking…' : 'Wake up'),
                ),
                TextButton.icon(onPressed: () => _edit(context), icon: const Icon(Icons.edit), label: const Text('Change')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
