import '../../models/schedule_slot.dart';

abstract class ScheduleRepository {
  List<ScheduleSlot> getSlots();

  /// Adds a slot and returns the updated list.
  List<ScheduleSlot> addSlot(ScheduleSlot slot);
}
