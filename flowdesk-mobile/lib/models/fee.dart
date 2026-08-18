enum PaymentMethod { ewallet, card, netbanking, cash }

class FeeItem {
  const FeeItem({
    required this.id,
    required this.name,
    required this.amount,
    required this.dueDate,
    required this.status,
    this.paidDate,
    this.method,
    this.receiptId,
  });

  final String id;
  final String name;
  final int amount;
  final String dueDate;
  final FeeStatus status;
  final String? paidDate;
  final PaymentMethod? method;
  final String? receiptId;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'amount': amount,
        'dueDate': dueDate,
        'status': status.name,
        'paidDate': paidDate,
        'method': method?.name,
        'receiptId': receiptId,
      };

  factory FeeItem.fromJson(Map<String, dynamic> json) => FeeItem(
        id: json['id'] as String,
        name: json['name'] as String,
        amount: (json['amount'] as num).toInt(),
        dueDate: json['dueDate'] as String,
        status: FeeStatus.values.firstWhere(
            (s) => s.name == json['status'],
            orElse: () => FeeStatus.pending),
        paidDate: json['paidDate'] as String?,
        method: json['method'] == null
            ? null
            : PaymentMethod.values.firstWhere((m) => m.name == json['method']),
        receiptId: json['receiptId'] as String?,
      );
}

enum FeeStatus { paid, pending }

class Receipt {
  const Receipt({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.itemName,
    required this.amount,
    required this.date,
    required this.method,
    required this.transactionId,
  });

  final String id;
  final String studentId;
  final String studentName;
  final String itemName;
  final int amount;
  final String date;
  final PaymentMethod method;
  final String transactionId;

  Map<String, dynamic> toJson() => {
        'id': id,
        'studentId': studentId,
        'studentName': studentName,
        'itemName': itemName,
        'amount': amount,
        'date': date,
        'method': method.name,
        'transactionId': transactionId,
      };

  factory Receipt.fromJson(Map<String, dynamic> json) => Receipt(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        studentName: json['studentName'] as String,
        itemName: json['itemName'] as String,
        amount: (json['amount'] as num).toInt(),
        date: json['date'] as String,
        method: PaymentMethod.values.firstWhere(
            (m) => m.name == json['method'],
            orElse: () => PaymentMethod.ewallet),
        transactionId: json['transactionId'] as String,
      );
}

extension PaymentMethodX on PaymentMethod {
  String get label => switch (this) {
        PaymentMethod.ewallet => 'E-Wallet',
        PaymentMethod.card => 'Card',
        PaymentMethod.netbanking => 'Net Banking',
        PaymentMethod.cash => 'Cash',
      };
}
