/// Club codes shared with the Budget Golfers API (`clubs[].code`).
class ClubType {
  final String code;
  final String label;
  final String short;

  const ClubType(this.code, this.label, this.short);
}

class Clubs {
  Clubs._();

  /// Every club the app knows, longest to shortest. The order is used for
  /// pickers, the bag list and tie-breaks in club suggestions.
  static const List<ClubType> all = [
    ClubType('driver', 'Driver', 'Dr'),
    ClubType('3w', '3 wood', '3w'),
    ClubType('5w', '5 wood', '5w'),
    ClubType('7w', '7 wood', '7w'),
    ClubType('2h', '2 hybrid', '2h'),
    ClubType('3h', '3 hybrid', '3h'),
    ClubType('4h', '4 hybrid', '4h'),
    ClubType('5h', '5 hybrid', '5h'),
    ClubType('6h', '6 hybrid', '6h'),
    ClubType('2i', '2 iron', '2i'),
    ClubType('3i', '3 iron', '3i'),
    ClubType('4i', '4 iron', '4i'),
    ClubType('5i', '5 iron', '5i'),
    ClubType('6i', '6 iron', '6i'),
    ClubType('7i', '7 iron', '7i'),
    ClubType('8i', '8 iron', '8i'),
    ClubType('9i', '9 iron', '9i'),
    ClubType('pw', 'Pitching wedge', 'PW'),
    ClubType('gw', 'Gap wedge', 'GW'),
    ClubType('sw', 'Sand wedge', 'SW'),
    ClubType('lw', 'Lob wedge', 'LW'),
    ClubType('putter', 'Putter', 'Pt'),
  ];

  /// A typical 14-club bag used until the golfer edits theirs.
  static const List<String> defaultBag = [
    'driver',
    '3w',
    '5w',
    '4h',
    '5i',
    '6i',
    '7i',
    '8i',
    '9i',
    'pw',
    'gw',
    'sw',
    'lw',
    'putter',
  ];

  /// The rules of golf allow at most 14 clubs in the bag.
  static const int maxInBag = 14;

  static ClubType? byCode(String? code) {
    if (code == null) return null;
    for (final c in all) {
      if (c.code == code) return c;
    }
    return null;
  }

  static String label(String? code) => byCode(code)?.label ?? (code ?? '—');

  static String short(String? code) => byCode(code)?.short ?? (code ?? '—');

  /// Position of [code] in [all] (unknown codes sort last).
  static int order(String code) {
    for (var i = 0; i < all.length; i++) {
      if (all[i].code == code) return i;
    }
    return all.length;
  }

  /// Turns free-text club names ("7 Iron", "3W", "Sand wedge", "Hybrid 4")
  /// into an API code. Ported from the old app's `_canon` rules.
  /// Returns null when the name isn't recognised.
  static String? canonicalise(String? raw) {
    if (raw == null) return null;
    final s = raw.trim().toUpperCase().replaceAll(RegExp(r'[\s\-_.]'), '');
    if (s.isEmpty) return null;

    final lower = s.toLowerCase();
    if (byCode(lower) != null) return lower;

    if (s.startsWith('PUTT')) return 'putter';
    if (s == 'D' || s == 'DR' || s == '1W' || s.startsWith('DRIVER')) {
      return 'driver';
    }
    if (s == 'PW' || s.startsWith('PITCH')) return 'pw';
    if (s == 'GW' || s == 'AW' || s.startsWith('GAP') || s.startsWith('APPROACH')) {
      return 'gw';
    }
    if (s == 'SW' || s.startsWith('SAND')) return 'sw';
    if (s == 'LW' || s.startsWith('LOB')) return 'lw';

    String? numbered(RegExp before, RegExp after, String suffix) {
      final m = before.firstMatch(s) ?? after.firstMatch(s);
      if (m == null) return null;
      final code = '${m.group(1)}$suffix';
      return byCode(code) != null ? code : null;
    }

    return numbered(RegExp(r'^(\d)(W|WOOD)$'), RegExp(r'^(?:W|WOOD)(\d)$'), 'w') ??
        numbered(RegExp(r'^(\d)(H|HY|HYB|HYBRID)$'),
            RegExp(r'^(?:H|HY|HYB|HYBRID)(\d)$'), 'h') ??
        numbered(RegExp(r'^(\d)(I|IRON)?$'), RegExp(r'^(?:I|IRON)(\d)$'), 'i');
  }
}

/// One club in the golfer's bag, plus a typed-in distance used until the club
/// has enough recorded shots.
class BagClub {
  final String code;
  final bool inBag;
  final double? manualMetres;

  const BagClub({required this.code, required this.inBag, this.manualMetres});

  String get label => Clubs.label(code);

  BagClub copyWith({bool? inBag, double? manualMetres, bool clearManual = false}) {
    return BagClub(
      code: code,
      inBag: inBag ?? this.inBag,
      manualMetres: clearManual ? null : (manualMetres ?? this.manualMetres),
    );
  }

  /// Shape of one entry in `PUT /api/clubs/:userId`.
  Map<String, dynamic> toApiJson() => {
        'code': code,
        'label': label,
        'inBag': inBag,
      };
}
