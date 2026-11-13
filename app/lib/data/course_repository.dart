import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'app_database.dart';

/// Self-named courses. Lots of municipal courses aren't in any course
/// database, so golfers type the name and the app remembers the pars they
/// enter for it, like the old `ParStore` did for one course.
class CourseRepository {
  CourseRepository._();

  static final CourseRepository instance = CourseRepository._();

  /// Pars used until the golfer edits them (the old app's defaults).
  static const List<int> defaultPars = [
    4, 4, 3, 5, 4, 4, 3, 4, 5, //
    4, 5, 4, 4, 3, 4, 5, 3, 4,
  ];

  Database get _db => AppDatabase.instance.db;

  /// "  Omanu   GC " → "omanu gc"
  static String keyFor(String name) =>
      name.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  /// Course names used before, most recent first, for suggestions.
  Future<List<String>> names() async {
    final rows = await _db.query('courses', columns: ['name'], orderBy: 'last_used DESC');
    return rows.map((r) => r['name'] as String).toList();
  }

  /// The 18 pars remembered for [name], or the defaults for a new course.
  Future<List<int>> parsFor(String name) async {
    final rows = await _db.query(
      'courses',
      where: 'name_key = ?',
      whereArgs: [keyFor(name)],
      limit: 1,
    );
    if (rows.isEmpty) return List<int>.from(defaultPars);
    final list = (jsonDecode(rows.first['pars'] as String) as List)
        .map((e) => (e as num).toInt())
        .toList();
    return list.length == 18 ? list : List<int>.from(defaultPars);
  }

  /// Saves [name] with its 18 pars and marks it as just used.
  Future<void> save(String name, List<int> pars18) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    await _db.insert(
      'courses',
      {
        'name_key': keyFor(trimmed),
        'name': trimmed,
        'pars': jsonEncode(pars18),
        'last_used': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Updates one hole's par for [name] (1-based [holeNumber]).
  Future<void> setPar(String name, int holeNumber, int par) async {
    final pars = await parsFor(name);
    if (holeNumber < 1 || holeNumber > 18) return;
    pars[holeNumber - 1] = par;
    await save(name, pars);
  }
}
