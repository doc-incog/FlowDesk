import 'dart:math';

import '../../core/utils/format.dart';
import '../../data/fees_data.dart' as data;
import '../../data/mock_data.dart' as mock;
import '../../models/fee.dart';
import '../../models/role.dart';
import '../contract/fees_repository.dart';
import '../persisted_store.dart';

const _feesKey = 'flowdesk.fees';
const _receiptsKey = 'flowdesk.receipts';

class MockFeesRepository implements FeesRepository {
  MockFeesRepository(this._store);

  final PersistedStore _store;

  final _random = Random();

  @override
  List<FeeItem> getFeeItems() =>
      _store.load(_feesKey, data.feeStructure, (f) => f.toJson(), FeeItem.fromJson);

  @override
  List<Receipt> getReceipts() =>
      _store.load(_receiptsKey, data.seedReceipts, (r) => r.toJson(), Receipt.fromJson);

  @override
  PayResult pay(FeeItem item, PaymentMethod method) {
    final id = 'RCP-${1000 + _random.nextInt(9000)}';
    final tx = 'TXN-${1000 + _random.nextInt(9000)}-${1000 + _random.nextInt(9000)}';
    final student = mock.demoUsers[Role.student]!;

    final receipt = Receipt(
      id: id,
      studentId: student.id,
      studentName: student.name,
      itemName: item.name,
      amount: item.amount,
      date: formatToday(),
      method: method,
      transactionId: tx,
    );

    final items = getFeeItems()
        .map((f) => f.id == item.id
            ? FeeItem(
                id: f.id,
                name: f.name,
                amount: f.amount,
                dueDate: f.dueDate,
                status: FeeStatus.paid,
                paidDate: formatToday(),
                method: method,
                receiptId: id,
              )
            : f)
        .toList();
    _store.save(_feesKey, items, (f) => f.toJson());

    final receipts = [receipt, ...getReceipts()];
    _store.save(_receiptsKey, receipts, (r) => r.toJson());

    return PayResult(items: items, receipts: receipts);
  }
}
