import '../../models/feedback.dart';

abstract class FeedbackRepository {
  List<FeedbackTarget> getTargets();
  List<FeedbackEntry> getEntries();
  List<FeedbackEntry> addEntry(FeedbackEntry entry);
}
