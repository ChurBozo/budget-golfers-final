import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colours from the Budget Golfers mood board, shared with the website.
class Palette {
  Palette._();

  static const Color bottleGreen = Color(0xFF006A4E); // primary, buttons
  static const Color fairwayDark = Color(0xFF0B3D2E); // headings, dark bars
  static const Color turquoise = Color(0xFFA0D6B4); // accents, focus
  static const Color lightCyan = Color(0xFFE0FFFF); // tints
  static const Color sand = Color(0xFFE9DDC0); // bogey marker
  static const Color flagRed = Color(0xFFC8402A); // errors, double bogey

  static const Color pageLight = Color(0xFFF3F7F5);
  static const Color pageDark = Color(0xFF0E1412);
  static const Color surfaceDark = Color(0xFF16201C);

  /// Map pins (kept from the old app so they read the same).
  static const Color targetPin = Color(0xFFD32F2F);
  static const Color ballPin = Color(0xFFFF9800);
}

class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: Palette.bottleGreen,
      brightness: brightness,
      primary: dark ? Palette.turquoise : Palette.bottleGreen,
      error: Palette.flagRed,
    );
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      scaffoldBackgroundColor: dark ? Palette.pageDark : Palette.pageLight,
    );
    // Nunito for body text and numbers, Poppins for headings (as on the web).
    final body = GoogleFonts.nunitoTextTheme(base.textTheme);
    TextStyle heading(TextStyle? s, FontWeight w) =>
        GoogleFonts.poppins(textStyle: s, fontWeight: w);
    return base.copyWith(
      textTheme: body.copyWith(
        displaySmall: heading(body.displaySmall, FontWeight.w700),
        headlineMedium: heading(body.headlineMedium, FontWeight.w700),
        headlineSmall: heading(body.headlineSmall, FontWeight.w600),
        titleLarge: heading(body.titleLarge, FontWeight.w600),
        titleMedium: heading(body.titleMedium, FontWeight.w600),
      ),
    );
  }

  /// Background for a score against par, matching the website's scorecard:
  /// birdie or better green, par plain, bogey sand, double bogey or worse red.
  static Color scoreColour(int strokes, int par, {required bool dark}) {
    final diff = strokes - par;
    if (diff <= -1) return Palette.bottleGreen;
    if (diff == 0) return dark ? Palette.surfaceDark : Colors.white;
    if (diff == 1) return Palette.sand;
    return Palette.flagRed;
  }

  static Color onScoreColour(int strokes, int par, {required bool dark}) {
    final diff = strokes - par;
    if (diff <= -1 || diff >= 2) return Colors.white;
    if (diff == 1) return Palette.fairwayDark;
    return dark ? Colors.white : Palette.fairwayDark;
  }
}
