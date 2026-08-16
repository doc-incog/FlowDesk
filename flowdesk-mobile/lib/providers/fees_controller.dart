import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/fee.dart';
import 'repositories.dart';

typedef FeesState = ({List<FeeItem> items, List<Receipt> receipts});

class FeesController extends Notifier<FeesState> {
  @override
  FeesState build() {
    final repo = ref.watch(feesRepositoryProvider);
    return (items: repo.getFeeItems(), receipts: repo.getReceipts());
  }

  FeesState pay(FeeItem item, PaymentMethod method) {
    final result = ref.read(feesRepositoryProvider).pay(item, method);
    state = (items: result.items, receipts: result.receipts);
    return state;
  }
}

final feesProvider = NotifierProvider<FeesController, FeesState>(FeesController.new);
