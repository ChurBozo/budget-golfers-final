import 'package:flutter/material.dart';

import '../app.dart';
import '../config.dart';
import '../data/api_client.dart';
import '../data/round_repository.dart';
import '../services.dart';
import '../theme.dart';
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

/// Where rounds are uploaded. The default comes from API_BASE_URL at build
/// time; changing it here helps when testing on a phone against a computer
/// on the same Wi-Fi (for example http://192.168.1.20:3000).
class _ServerCard extends StatelessWidget {
  const _ServerCard();

  Future<void> _edit(BuildContext context) async {
    final controller = TextEditingController(text: Services.account.baseUrl);
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
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
    );
    controller.dispose();
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
              children: [
                OutlinedButton.icon(onPressed: () => _check(context), icon: const Icon(Icons.wifi_tethering), label: const Text('Check')),
                TextButton.icon(onPressed: () => _edit(context), icon: const Icon(Icons.edit), label: const Text('Change')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
