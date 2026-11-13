import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../models/round.dart';
import 'app_database.dart';
import 'download_service.dart';

/// What the upload queue needs from the round store (a fake is used in tests).
abstract class RoundStore {
  Future<List<Round>> pendingUploads();
  Future<List<Round>> failedUploads();
  Future<void> save(Round round);
}

/// Saves and loads rounds. The round being played is saved after every
/// button press (the old app's draft autosave), so closing the app or a
/// crash never loses a shot.
class RoundRepository implements RoundStore, RoundLibrary {
  RoundRepository._();

  static final RoundRepository instance = RoundRepository._();

  Database get _db => AppDatabase.instance.db;

  @override
  Future<void> save(Round round) async {
    round.touch();
    await _db.insert(
      'rounds',
      {
        'client_round_id': round.clientRoundId,
        'finished': round.finished ? 1 : 0,
        'sync_status': round.syncStatus,
        'played_at': round.playedAt.toIso8601String(),
        'updated_at': round.updatedAt.toIso8601String(),
        'json': jsonEncode(round.toJson()),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// The unfinished round, if there is one.
  Future<Round?> activeRound() async {
    final rows = await _db.query(
      'rounds',
      where: 'finished = 0',
      orderBy: 'updated_at DESC',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _decode(rows.first);
  }

  /// Finished rounds, newest first.
  @override
  Future<List<Round>> finishedRounds() async {
    final rows = await _db.query(
      'rounds',
      where: 'finished = 1',
      orderBy: 'played_at DESC',
    );
    return rows.map(_decode).toList();
  }

  /// Finished rounds still waiting to upload, oldest first (the upload queue).
  @override
  Future<List<Round>> pendingUploads() => _withStatus(SyncStatus.pending);

  /// Rounds the server refused, oldest first.
  @override
  Future<List<Round>> failedUploads() => _withStatus(SyncStatus.failed);

  Future<List<Round>> _withStatus(String status) async {
    final rows = await _db.query(
      'rounds',
      where: 'finished = 1 AND sync_status = ?',
      whereArgs: [status],
      orderBy: 'played_at ASC',
    );
    return rows.map(_decode).toList();
  }

  @override
  Future<Round?> byId(String clientRoundId) async {
    final rows = await _db.query(
      'rounds',
      where: 'client_round_id = ?',
      whereArgs: [clientRoundId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _decode(rows.first);
  }

  Future<void> delete(String clientRoundId) async {
    await _db.delete(
      'rounds',
      where: 'client_round_id = ?',
      whereArgs: [clientRoundId],
    );
  }

  Future<void> deleteAll() async {
    await _db.delete('rounds');
  }

  Round _decode(Map<String, Object?> row) {
    final json = jsonDecode(row['json'] as String) as Map<String, dynamic>;
    return Round.fromJson(json);
  }
}
