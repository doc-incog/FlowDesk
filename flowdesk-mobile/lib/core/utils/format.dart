/// Formats an amount in Indian rupee notation (en-IN grouping).
/// Example: 100000 -> ₹1,00,000
String formatINR(int n) {
  final s = n.abs().toString();
  if (s.length <= 3) return '₹$s';
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[last3];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${n < 0 ? '-' : ''}₹${parts.join(',')}';
}

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// Formats a DateTime as "02 Aug 2026".
String formatDate(DateTime dt) {
  final d = dt.day.toString().padLeft(2, '0');
  return '$d ${_months[dt.month - 1]} ${dt.year}';
}

String formatToday() => formatDate(DateTime.now());

/// Formats a DateTime as "08:42 AM".
String formatTime(DateTime dt) {
  final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final m = dt.minute.toString().padLeft(2, '0');
  final suffix = dt.hour < 12 ? 'AM' : 'PM';
  return '$h:$m $suffix';
}

/// "HH:MM" 24h string to minutes since midnight.
int minutesOfDay(String hhmm) {
  final parts = hhmm.split(':');
  if (parts.length != 2) return 0;
  final h = int.tryParse(parts[0]) ?? 0;
  final m = int.tryParse(parts[1]) ?? 0;
  return h * 60 + m;
}

/// Whole days from today (midnight-normalized) to the given ISO date.
int daysUntil(String isoDate) {
  final parts = isoDate.split('-');
  if (parts.length != 3) return 0;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return 0;
  final target = DateTime(y, m, d);
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return target.difference(today).inDays;
}
