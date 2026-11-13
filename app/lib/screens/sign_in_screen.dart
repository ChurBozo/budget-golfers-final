import 'package:flutter/material.dart';

import '../data/api_client.dart';
import '../services.dart';
import '../theme.dart';
import '../widgets/stat_tile.dart';

/// Sign in or create a Budget Golfers account. Only shown when the golfer
/// wants to upload: the rest of the app never needs an account.
///
/// Pops with true when signed in.
class SignInScreen extends StatefulWidget {
  /// Start on "Create account" instead of "Sign in".
  final bool register;

  const SignInScreen({super.key, this.register = false});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _homeCourse = TextEditingController();

  late bool _register = widget.register;
  bool _busy = false;
  bool _showPassword = false;
  String? _error;
  Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    _email.text = Services.account.lastEmail ?? '';
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _homeCourse.dispose();
    super.dispose();
  }

  // The same rules as the API (A2 Table 10), so most mistakes are caught
  // before anything is sent.
  String? _checkEmail(String? v) {
    final s = (v ?? '').trim();
    if (s.isEmpty) return 'Enter your email';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(s)) return 'Enter a valid email address';
    return _fieldErrors['email'];
  }

  String? _checkPassword(String? v) {
    final s = v ?? '';
    if (s.isEmpty) return 'Enter your password';
    if (_register && s.length < 8) return 'Use at least 8 characters';
    if (_register && s.length > 72) return 'Use 72 characters or fewer';
    return _fieldErrors['password'];
  }

  String? _checkName(String? v) {
    final s = (v ?? '').trim();
    if (s.length < 2 || s.length > 30) return 'Use 2 to 30 characters';
    return _fieldErrors['displayName'];
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _fieldErrors = {};
    });
    if (!_form.currentState!.validate()) return;

    setState(() => _busy = true);
    try {
      if (_register) {
        await Services.account.register(
          email: _email.text,
          password: _password.text,
          displayName: _name.text,
          homeCourseName: _homeCourse.text,
        );
      } else {
        await Services.account.signIn(email: _email.text, password: _password.text);
      }
      // A different account than last time: ask before uploading rounds
      // that were finished while signed out.
      final previous = Services.account.previousUserId;
      if (previous != null) {
        final waiting = await Services.uploads.unclaimed();
        if (waiting.isNotEmpty && mounted) {
          final mine = await _askAboutWaiting(waiting.length);
          if (mine == false) await Services.uploads.keepFor(previous, waiting);
        }
      }
      // Send this phone's bag, then anything waiting.
      await Services.uploads.syncBag();
      final report = await Services.uploads.uploadPending();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Signed in as ${Services.account.account?.displayName}. ${report.summary}'),
      ));
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _fieldErrors = {for (final d in e.details) d.field: d.issue};
        _error = switch (e.code) {
          'EMAIL_TAKEN' => 'An account with this email already exists. Sign in instead.',
          'RATE_LIMITED' => e.message,
          'VALIDATION_FAILED' => 'Please check the highlighted fields.',
          _ => e.isNetwork
              ? '${e.message}\nServer: ${Services.account.baseUrl}'
              : e.message,
        };
        if (e.code == 'EMAIL_TAKEN') _fieldErrors['email'] = 'Already registered';
      });
      _form.currentState!.validate();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool?> _askAboutWaiting(int count) => showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: Text('Upload $count waiting round${count == 1 ? '' : 's'}?'),
          content: Text(
            'A different account was used on this phone before. '
            '${count == 1 ? 'This round was' : 'These rounds were'} finished while signed out. '
            'Are ${count == 1 ? 'it' : 'they'} yours (${Services.account.account?.displayName})?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('No, keep for the other account'),
            ),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Yes, upload')),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(_register ? 'Create account' : 'Sign in')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Text(
              'An account is only needed to upload your rounds to the Budget Golfers website, '
              'where you can see your stats, club distances and the leaderboard. '
              'Your rounds stay on this phone either way.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Sign in'), icon: Icon(Icons.login)),
                ButtonSegment(value: true, label: Text('Create account'), icon: Icon(Icons.person_add)),
              ],
              selected: {_register},
              onSelectionChanged: _busy
                  ? null
                  : (s) => setState(() {
                        _register = s.first;
                        _error = null;
                        _fieldErrors = {};
                      }),
            ),
            const SizedBox(height: 16),
            if (_register) ...[
              TextFormField(
                controller: _name,
                textInputAction: TextInputAction.next,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  helperText: 'Shown on the leaderboard, e.g. "Aroha M."',
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
                validator: _checkName,
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
              validator: _checkEmail,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _password,
              obscureText: !_showPassword,
              textInputAction: _register ? TextInputAction.next : TextInputAction.done,
              autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
              decoration: InputDecoration(
                labelText: 'Password',
                helperText: _register ? 'At least 8 characters' : null,
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  tooltip: _showPassword ? 'Hide password' : 'Show password',
                  icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _showPassword = !_showPassword),
                ),
              ),
              validator: _checkPassword,
              onFieldSubmitted: _register ? null : (_) => _submit(),
            ),
            if (_register) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _homeCourse,
                textInputAction: TextInputAction.done,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Home course (optional)',
                  helperText: 'Shown next to your name on the leaderboard',
                  prefixIcon: Icon(Icons.golf_course),
                ),
                validator: (v) {
                  final s = (v ?? '').trim();
                  if (s.isNotEmpty && (s.length < 2 || s.length > 80)) return 'Use 2 to 80 characters';
                  return _fieldErrors['homeCourseName'];
                },
                onFieldSubmitted: (_) => _submit(),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Palette.flagRed.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Palette.flagRed.withValues(alpha: 0.5)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline, color: Palette.flagRed),
                    const SizedBox(width: 10),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _busy ? null : _submit,
              icon: _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(_register ? Icons.person_add : Icons.cloud_upload),
              label: Text(_register ? 'Create account and upload' : 'Sign in and upload'),
            ),
            const SizedBox(height: 20),
            SectionCard(
              title: 'Server',
              child: Text(
                'Uploading to ${Services.account.baseUrl}. You can change this in Settings > Account.',
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
