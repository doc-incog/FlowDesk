import '../../data/mock_data.dart' as mock;
import '../../models/schedule_slot.dart';
import '../contract/schedule_repository.dart';
import '../persisted_store.dart';

const _scheduleKey = 'flowdesk.schedule';

class MockScheduleRepository implements ScheduleRepository {
  MockScheduleRepository(this._store);

  final PersistedStore _store;

  @override
  List<ScheduleSlot> getSlots() =>
      _store.load(_scheduleKey, mock.schedule, (s) => s.toJson(), ScheduleSlot.fromJson);

  @override
  List<ScheduleSlot> addSlot(ScheduleSlot slot) {
    final slots = getSlots();
    final next = [slot, ...slots];
    _store.save(_scheduleKey, next, (s) => s.toJson());
    return next;
  }
}
