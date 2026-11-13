import 'package:flutter/material.dart';

import '../data/round_repository.dart';
import '../data/upload_service.dart';
import '../screens/sign_in_screen.dart';
import '../services.dart';
import '../theme.dart';
import '../util/format.dart';

/// "Upload now": opens sign-in first if needed (signing in uploads straight
/// away), otherwise sends every waiting round and shows the result.
Future<void> uploadNow(BuildContext context) async {
  if (!Services.account.signedIn) {
    await Navigator.of(context).push(MaterialPageRoute<bool>(builder: (_) => const SignInScreen()));
    return;
  }
  final messenger = ScaffoldMessenger.of(context);
  final report = await Services.uploads.uploadPending();
  if (report.outcome == UploadOutcome.needsSignIn && context.mounted) {
    messenger.showSnackBar(SnackBar(content: Text(report.summary)));
    await Navigator.of(context).push(MaterialPageRoute<bool>(builder: (_) => const SignInScreen()));
    return;
  }
  messenger.showSnackBar(SnackBar(content: Text(report.summary)));
}

/// Account and upload status, on the home and settings screens.
class UploadCard extends StatefulWidget {
  /// Show sign-out and the last upload time (Settings).
  final bool detailed;

  const UploadCard({super.key, this.detailed = false});

  @override
  State<UploadCard> createState() => _UploadCardState();
}

class _UploadCardState extends State<UploadCard> {
  int _pending = 0;
  int _failed = 0;
  late final Listenable _changes = Listenable.merge([Services.account, Services.uploads]);

  @override
  void initState() {
    super.initState();
    _changes.addListener(_count);
    _count();
  }

  @override
  void dispose() {
    _changes.removeListener(_count);
    super.dispose();
  }

  Future<void> _count() async {
    final pending = await RoundRepository.instance.pendingUploads();
    final failed = await RoundRepository.instance.failedUploads();
    if (!mounted) return;
    setState(() {
      _pending = pending.length;
      _failed = failed.length;
    });
  }

  Future<void> _signOut() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'Your rounds stay on this phone and on the website. Rounds finished while signed out '
          'wait here until you sign in again.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok == true) await Services.account.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final account = Services.account;
    final uploads = Services.uploads;
    final a = account.account;
    final signedIn = account.signedIn && a != null;

    final String title;
    final String body;
    if (signedIn) {
      title = 'Signed in as ${a!.displayName}';
      body = uploads.busy
          ? 'Uploading…'
          : _pending == 0
              ? 'Every finished round is uploaded.'
              : '$_pending round${_pending == 1 ? '' : 's'} waiting to upload.';
    } else if (account.sessionExpired) {
      title = 'Sign in again to upload';
      body = 'Your sign-in has expired. ${_pending > 0 ? '$_pending round${_pending == 1 ? '' : 's'} waiting.' : ''}';
    } else {
      title = 'Upload to the website';
      body = _pending > 0
          ? '$_pending round${_pending == 1 ? '' : 's'} saved on this phone. Sign in to see them on the Budget Golfers website.'
          : 'Sign in when you want your rounds on the Budget Golfers website. No account is needed to play.';
    }

    final last = uploads.lastRunAt;
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 6),
      color: Palette.lightCyan.withValues(alpha: theme.brightness == Brightness.dark ? 0.08 : 0.6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Palette.turquoise),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(signedIn ? Icons.cloud_done : Icons.cloud_upload_outlined, color: theme.colorScheme.primary),
                const SizedBox(width: 10),
                Expanded(child: Text(title, style: theme.textTheme.titleMedium)),
                if (uploads.busy) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ],
            ),
            const SizedBox(height: 6),
            Text(body, style: theme.textTheme.bodyMedium),
            if (_failed > 0) ...[
              const SizedBox(height: 4),
              Text(
                '$_failed round${_failed == 1 ? '' : 's'} could not be uploaded. Open ${_failed == 1 ? 'it' : 'them'} in Past Rounds to see why.',
                style: theme.textTheme.bodySmall?.copyWith(color: Palette.flagRed),
              ),
            ],
            if (widget.detailed && signedIn) ...[
              const SizedBox(height: 4),
              Text(a!.email, style: theme.textTheme.bodySmall),
              if (last != null) Text('Last upload check: ${Fmt.dateTime(last)}', style: theme.textTheme.bodySmall),
            ],
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if (!signedIn)
                  FilledButton.icon(
                    onPressed: () => uploadNow(context),
                    icon: const Icon(Icons.login),
                    label: const Text('Sign in to upload'),
                  )
                else
                  FilledButton.tonalIcon(
                    onPressed: uploads.busy || _pending == 0 ? null : () => uploadNow(context),
                    icon: const Icon(Icons.cloud_upload),
                    label: const Text('Upload now'),
                  ),
                if (widget.detailed && signedIn)
                  TextButton.icon(onPressed: _signOut, icon: const Icon(Icons.logout), label: const Text('Sign out')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
