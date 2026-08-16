import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/feedback.dart';
import 'repositories.dart';

final feedbackTargetsProvider = Provider<List<FeedbackTarget>>(
  (ref) => ref.watch(feedbackRepositoryProvider).getTargets(),
);

class FeedbackController extends Notifier<List<FeedbackEntry>> {
  @override
  List<FeedbackEntry> build() {
    return ref.watch(feedbackRepositoryProvider).getEntries();
  }

  void add(FeedbackEntry entry) {
    state = ref.read(feedbackRepositoryProvider).addEntry(entry);
  }
}

final feedbackProvider =
    NotifierProvider<FeedbackController, List<FeedbackEntry>>(FeedbackController.new);
