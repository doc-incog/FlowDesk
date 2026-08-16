import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/mock_data.dart' as mock;
import '../models/check_in.dart';
import '../models/role.dart';

typedef CheckInState = ({List<CheckInRecord> records, bool checkedIn});

class CheckInController extends Notifier<CheckInState> {
  @override
  CheckInState build() => (records: List.of(mock.checkIns), checkedIn: false);

  void checkIn(String name, Role role, CheckInMethod method) {
    if (state.checkedIn) return;
    final now = DateTime.now();
    final record = CheckInRecord(
      id: 'me-${now.millisecondsSinceEpoch}',
      name: name,
      role: role,
      time: _formatTime(now),
      status: CheckInStatus.onTime,
      method: method,
    );
    state = (records: [record, ...state.records], checkedIn: true);
  }

  void reset() => state = (records: state.records, checkedIn: false);

  String _formatTime(DateTime dt) {
    final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final m = dt.minute.toString().padLeft(2, '0');
    final suffix = dt.hour < 12 ? 'AM' : 'PM';
    return '$h:$m $suffix';
  }
}

final checkInProvider =
    NotifierProvider<CheckInController, CheckInState>(CheckInController.new);
