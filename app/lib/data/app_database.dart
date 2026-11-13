import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// The phone's own SQLite database. Rounds stay here until they upload, so
/// patchy signal on the course never loses one.
class AppDatabase {
  AppDatabase._();

  static final AppDatabase instance = AppDatabase._();

  static const String _fileName = 'budget_golfers.db';
  static const int _version = 1;

  Database? _db;

  Database get db {
    final d = _db;
    if (d == null) {
      throw StateError('AppDatabase.open() must run before the database is used.');
    }
    return d;
  }

  Future<void> open() async {
    if (_db != null) return;
    final dir = await getDatabasesPath();
    _db = await openDatabase(
      p.join(dir, _fileName),
      version: _version,
      onCreate: _create,
    );
  }

  static Future<void> _create(Database db, int version) async {
    // One row per round; the round itself is stored as JSON so the shape can
    // follow the API without migrations. Indexed columns are for listing.
    await db.execute('''
      CREATE TABLE rounds (
        client_round_id TEXT PRIMARY KEY,
        finished INTEGER NOT NULL,
        sync_status TEXT NOT NULL,
        played_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        json TEXT NOT NULL
      )
    ''');
    await db.execute(
        'CREATE INDEX idx_rounds_finished_played ON rounds (finished, played_at)');

    // Self-named courses with the pars the golfer entered, keyed by a
    // normalised name so "Omanu GC" and "omanu gc" are the same course.
    await db.execute('''
      CREATE TABLE courses (
        name_key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pars TEXT NOT NULL,
        last_used TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE bag (
        code TEXT PRIMARY KEY,
        in_bag INTEGER NOT NULL,
        manual_metres REAL
      )
    ''');
  }
}
