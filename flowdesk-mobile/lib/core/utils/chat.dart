import '../../data/chat_data.dart';

/// Keyword scoring: counts how many of an entry's keywords appear
/// (case-insensitive substring) in the message and picks the highest score.
String answerFor(String message) {
  final text = message.toLowerCase();
  var best = '';
  var bestScore = 0;
  for (final faq in chatFaq) {
    var score = 0;
    for (final k in faq.keywords) {
      if (text.contains(k)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = faq.answer;
    }
  }
  return bestScore > 0 ? best : chatFallback;
}
