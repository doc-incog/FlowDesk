import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/schedule_slot.dart';
import 'repositories.dart';

class ScheduleController extends Notifier<List<ScheduleSlot>> {
  @override
  List<ScheduleSlot> build() {
    return ref.watch(scheduleRepositoryProvider).getSlots();
  }

  void addSlot(ScheduleSlot slot) {
    state = ref.read(scheduleRepositoryProvider).addSlot(slot);
  }
}

final scheduleProvider =
    NotifierProvider<ScheduleController, List<ScheduleSlot>>(ScheduleController.new);
