import '../../data/feedback_data.dart' as data;
import '../../models/feedback.dart';
import '../contract/feedback_repository.dart';
import '../persisted_store.dart';

const _feedbackKey = 'flowdesk.feedback';

class MockFeedbackRepository implements FeedbackRepository {
  MockFeedbackRepository(this._store);

  final PersistedStore _store;

  @override
  List<FeedbackTarget> getTargets() => data.feedbackTargets;

  @override
  List<FeedbackEntry> getEntries() => _store.load(
      _feedbackKey, data.seedFeedbackEntries, (e) => e.toJson(), FeedbackEntry.fromJson);

  @override
  List<FeedbackEntry> addEntry(FeedbackEntry entry) {
    final next = [entry, ...getEntries()];
    _store.save(_feedbackKey, next, (e) => e.toJson());
    return next;
  }
}
