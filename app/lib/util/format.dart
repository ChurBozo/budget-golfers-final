/// Display helpers. Distances are always stored in metres and only converted
/// for the screen, as the API does.
class Fmt {
  Fmt._();

  static const double yardsPerMetre = 1.0936133;

  static const List<String> _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  static String distance(double? metres, {required bool metric}) {
    if (metres == null) return '—';
    if (metric) return '${metres.round()} m';
    return '${(metres * yardsPerMetre).round()} yd';
  }

  static String unit(bool metric) => metric ? 'm' : 'yd';

  /// Converts a value typed in the golfer's units back to metres.
  static double toMetres(double value, {required bool metric}) =>
      metric ? value : value / yardsPerMetre;

  static double fromMetres(double metres, {required bool metric}) =>
      metric ? metres : metres * yardsPerMetre;

  static String toPar(int diff) {
    if (diff == 0) return 'E';
    return diff > 0 ? '+$diff' : '$diff';
  }

  static String monthShort(DateTime d) => _months[d.month - 1];

  /// 12 Sep 2026
  static String date(DateTime d) => '${d.day} ${monthShort(d)} ${d.year}';

  /// 12 Sep, 4:41 pm
  static String dateTime(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final m = d.minute.toString().padLeft(2, '0');
    final ampm = d.hour < 12 ? 'am' : 'pm';
    return '${d.day} ${monthShort(d)}, $h:$m $ampm';
  }

  static String percent(double? value) =>
      value == null ? '—' : '${value.round()}%';

  /// "3.2° right", "1.0° left"
  static String bias(double? deg) {
    if (deg == null) return '—';
    if (deg.abs() < 0.05) return 'straight';
    return '${deg.abs().toStringAsFixed(1)}° ${deg > 0 ? 'right' : 'left'}';
  }

  static String oneDecimal(double? v) => v == null ? '—' : v.toStringAsFixed(1);
}
