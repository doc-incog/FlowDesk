import '../../models/fee.dart';

class PayResult {
  const PayResult({required this.items, required this.receipts});

  final List<FeeItem> items;
  final List<Receipt> receipts;
}

abstract class FeesRepository {
  List<FeeItem> getFeeItems();
  List<Receipt> getReceipts();

  /// Marks the fee item as paid, generates a receipt and returns updated state.
  PayResult pay(FeeItem item, PaymentMethod method);
}
