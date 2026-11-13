import 'package:sqflite/sqflite.dart';

import '../models/clubs.dart';
import 'app_database.dart';

/// The golfer's bag: which clubs they carry and any distances they typed in.
class BagRepository {
  BagRepository._();

  static final BagRepository instance = BagRepository._();

  Database get _db => AppDatabase.instance.db;

  /// Every known club, in [Clubs.all] order, with this golfer's settings.
  /// A fresh install starts with [Clubs.defaultBag].
  Future<List<BagClub>> load() async {
    final rows = await _db.query('bag');
    final saved = <String, Map<String, Object?>>{
      for (final r in rows) r['code'] as String: r,
    };
    return Clubs.all.map((c) {
      final row = saved[c.code];
      if (row == null) {
        return BagClub(
          code: c.code,
          inBag: saved.isEmpty && Clubs.defaultBag.contains(c.code),
        );
      }
      return BagClub(
        code: c.code,
        inBag: (row['in_bag'] as int) == 1,
        manualMetres: (row['manual_metres'] as num?)?.toDouble(),
      );
    }).toList();
  }

  /// Clubs currently in the bag, longest first.
  Future<List<BagClub>> inBag() async =>
      (await load()).where((b) => b.inBag).toList();

  /// Saves the whole bag. The first save also fixes the defaults in place.
  Future<void> saveAll(List<BagClub> bag) async {
    final batch = _db.batch();
    for (final b in bag) {
      batch.insert(
        'bag',
        {
          'code': b.code,
          'in_bag': b.inBag ? 1 : 0,
          'manual_metres': b.manualMetres,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }
}
