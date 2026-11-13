import 'package:flutter/foundation.dart';

import '../models/clubs.dart';
import '../models/round.dart';
import 'account_controller.dart';
import 'api_client.dart';
import 'round_repository.dart';

enum UploadOutcome {
  /// Nothing was waiting.
  nothingToDo,

  /// Every waiting round was stored (some may have been refused, see [UploadReport.refused]).
  done,

  /// Not signed in, or the token ran out: the golfer needs to sign in.
  needsSignIn,

  /// No connection, or the server is busy (429 / 5xx). Rounds stay queued.
  tryLater,

  /// Another upload is already running.
  busy,
}

class UploadReport {
  final UploadOutcome outcome;
  final int uploaded;
  final int duplicates;
  final int refused;
  final String? message;

  const UploadReport(
    this.outcome, {
    this.uploaded = 0,
    this.duplicates = 0,
    this.refused = 0,
    this.message,
  });

  /// One line for a snackbar.
  String get summary {
    switch (outcome) {
      case UploadOutcome.nothingToDo:
        return 'Every round is already uploaded.';
      case UploadOutcome.needsSignIn:
        return message ?? 'Sign in to upload your rounds.';
      case UploadOutcome.busy:
        return 'Already uploading…';
      case UploadOutcome.tryLater:
        final done = uploaded + duplicates;
        final start = done > 0 ? '$done uploaded. ' : '';
        return '$start${message ?? 'Could not reach the server.'} Waiting rounds will upload later.';
      case UploadOutcome.done:
        final parts = <String>[
          if (uploaded + duplicates > 0) '${uploaded + duplicates} round${uploaded + duplicates == 1 ? '' : 's'} uploaded',
          if (refused > 0) '$refused could not be uploaded',
        ];
        return parts.isEmpty ? 'Nothing to upload.' : '${parts.join(', ')}.';
    }
  }
}

/// The upload queue. Finished rounds wait on the phone (sync status
/// "pending") and are sent one at a time, oldest first, with POST /api/rounds.
///
/// Reply handling:
///  * 201 created / 200 duplicate -> "synced". A retry after a dropped
///    connection is safe: the server matches the clientRoundId (A2 section 6.6).
///  * 422 -> "failed", with the reason saved on the round. The next round goes on.
///  * 401 -> the session has run out; stop and ask the golfer to sign in.
///  * no connection, 429, 5xx -> stop; the rounds stay queued for later.
///
/// Uploads start when a round is finished, when the app opens or comes back
/// to the front, when the phone gets a connection, and from "Upload now".
class UploadService extends ChangeNotifier {
  final AccountController account;
  final RoundStore rounds;
  final Future<List<BagClub>> Function() loadBag;

  /// Automatic uploads are skipped if one ran this recently.
  final Duration autoInterval;

  bool _busy = false;
  DateTime? _lastAuto;
  UploadReport? _lastReport;
  DateTime? _lastRunAt;

  UploadService({
    required this.account,
    required this.rounds,
    required this.loadBag,
    this.autoInterval = const Duration(seconds: 30),
  });

  ApiClient get _api => account.api;
  bool get busy => _busy;
  UploadReport? get lastReport => _lastReport;
  DateTime? get lastRunAt => _lastRunAt;

  /// For automatic triggers: does nothing when signed out, and runs at most
  /// once per [autoInterval].
  Future<void> autoUpload() async {
    if (!account.signedIn || _busy) return;
    final last = _lastAuto;
    if (last != null && DateTime.now().difference(last) < autoInterval) return;
    _lastAuto = DateTime.now();
    await uploadPending();
  }

  /// Sends every waiting round. Safe to call at any time.
  Future<UploadReport> uploadPending() async {
    if (_busy) return const UploadReport(UploadOutcome.busy);
    if (!account.signedIn) {
      return _finish(UploadReport(
        UploadOutcome.needsSignIn,
        message: account.sessionExpired ? 'Your sign-in has expired. Sign in again to upload.' : null,
      ));
    }

    _busy = true;
    notifyListeners();
    var uploaded = 0, duplicates = 0, refused = 0;
    try {
      final me = account.account!.userId;
      // Rounds kept for another account wait until that account signs in.
      final queue = (await rounds.pendingUploads())
          .where((r) => r.ownerUserId == null || r.ownerUserId == me)
          .toList();
      if (queue.isEmpty) return _finish(const UploadReport(UploadOutcome.nothingToDo));

      // The server checks custom clubs against the bag, so send it first.
      if (!(account.account?.bagSynced ?? false)) {
        await _syncBag(quiet: true);
      }

      final deviceId = await account.deviceId();
      for (final round in queue) {
        round.ownerUserId ??= me;
        try {
          final result = await _api.uploadRound(round.toApiJson(), deviceId: deviceId);
          round
            ..syncStatus = SyncStatus.synced
            ..serverRoundId = result.data['id'] as String?
            ..syncedAt = DateTime.now()
            ..syncError = null;
          await rounds.save(round);
          if (result.data['duplicate'] == true) {
            duplicates++;
          } else {
            uploaded++;
          }
          notifyListeners();
        } on ApiException catch (e) {
          if (e.isUnauthenticated) {
            await account.expireSession();
            return _finish(UploadReport(
              UploadOutcome.needsSignIn,
              uploaded: uploaded,
              duplicates: duplicates,
              refused: refused,
              message: 'Your sign-in has expired. Sign in again to upload.',
            ));
          }
          if (e.isTemporary) {
            return _finish(UploadReport(
              UploadOutcome.tryLater,
              uploaded: uploaded,
              duplicates: duplicates,
              refused: refused,
              message: e.message,
            ));
          }
          // 400, 403, 404, 409, 422: this round cannot be stored as it is.
          round
            ..syncStatus = SyncStatus.failed
            ..syncError = describe(e, round);
          await rounds.save(round);
          refused++;
          notifyListeners();
        }
      }
      return _finish(UploadReport(UploadOutcome.done, uploaded: uploaded, duplicates: duplicates, refused: refused));
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Waiting rounds no account has uploaded yet (finished while signed out).
  Future<List<Round>> unclaimed() async =>
      (await rounds.pendingUploads()).where((r) => r.ownerUserId == null).toList();

  /// After a different account signs in on this phone and the golfer says the
  /// waiting rounds are not theirs: keep them for the previous account.
  Future<void> keepFor(String userId, List<Round> waiting) async {
    for (final r in waiting) {
      r.ownerUserId = userId;
      await rounds.save(r);
    }
    notifyListeners();
  }

  /// Puts a refused round back in the queue and tries again.
  Future<UploadReport> retry(Round round) async {
    round
      ..syncStatus = SyncStatus.pending
      ..syncError = null;
    await rounds.save(round);
    notifyListeners();
    return uploadPending();
  }

  /// Sends the phone's bag with PUT /api/clubs/:userId. Called after sign-in
  /// and whenever the bag changes. Returns false if it did not reach the server.
  Future<bool> syncBag() => _syncBag(quiet: false);

  Future<bool> _syncBag({required bool quiet}) async {
    final a = account.account;
    if (a == null || !account.signedIn) return false;
    try {
      final bag = await loadBag();
      await _api.putClubs(a.userId, bag.map((b) => b.toApiJson()).toList());
      await account.markBagSynced();
      return true;
    } on ApiException catch (e) {
      if (e.isUnauthenticated) await account.expireSession();
      if (!quiet) debugPrint('Bag upload failed: $e');
      return false;
    }
  }

  /// Turns the API's details into text for the round screen, e.g.
  /// "holes[3].strokes must be between 1 and 20" -> "Hole 13 strokes must be
  /// between 1 and 20" (index 3 of a back-nine round is hole 13).
  static String describe(ApiException e, [Round? round]) {
    if (e.details.isEmpty) return e.message;
    final sent = round?.holes.where((h) => h.played).map((h) => h.number).toList();
    final lines = e.details.take(4).map((d) => '${_friendlyField(d.field, sent)} ${d.issue}');
    final more = e.details.length > 4 ? ' (and ${e.details.length - 4} more)' : '';
    return '${lines.join('; ')}$more';
  }

  static String _friendlyField(String field, List<int>? holeNumbers) {
    final m = RegExp(r'^holes\[(\d+)\]\.?(.*)$').firstMatch(field);
    if (m == null) return field;
    final index = int.parse(m.group(1)!);
    final n = (holeNumbers != null && index < holeNumbers.length) ? holeNumbers[index] : index + 1;
    final rest = m.group(2)!.replaceAll(RegExp(r'shots\[(\d+)\]'), 'shot').replaceAll('.', ' ');
    return rest.isEmpty ? 'Hole $n' : 'Hole $n $rest';
  }

  UploadReport _finish(UploadReport report) {
    _lastReport = report;
    _lastRunAt = DateTime.now();
    return report;
  }
}
