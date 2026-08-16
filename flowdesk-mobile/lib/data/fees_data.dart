import '../models/fee.dart';

const feeStructure = <FeeItem>[
  FeeItem(id: 'f1', name: 'Tuition Fee', amount: 85000, dueDate: '10 Sep 2026', status: FeeStatus.paid, paidDate: '05 Aug 2026', method: PaymentMethod.upi, receiptId: 'RCP-1001'),
  FeeItem(id: 'f2', name: 'Hostel Fee', amount: 42000, dueDate: '10 Sep 2026', status: FeeStatus.pending),
  FeeItem(id: 'f3', name: 'Library Fee', amount: 4500, dueDate: '10 Sep 2026', status: FeeStatus.pending),
  FeeItem(id: 'f4', name: 'Laboratory Fee', amount: 8000, dueDate: '10 Sep 2026', status: FeeStatus.paid, paidDate: '12 Jul 2026', method: PaymentMethod.card, receiptId: 'RCP-1000'),
  FeeItem(id: 'f5', name: 'Examination Fee', amount: 2500, dueDate: '10 Sep 2026', status: FeeStatus.pending),
  FeeItem(id: 'f6', name: 'Transport Fee', amount: 12000, dueDate: '10 Sep 2026', status: FeeStatus.pending),
];

const seedReceipts = <Receipt>[
  Receipt(id: 'RCP-1001', studentId: 'STU-2043', studentName: 'Aisha Karim', itemName: 'Tuition Fee', amount: 85000, date: '05 Aug 2026', method: PaymentMethod.upi, transactionId: 'TXN-8472-1120'),
  Receipt(id: 'RCP-1000', studentId: 'STU-2043', studentName: 'Aisha Karim', itemName: 'Laboratory Fee', amount: 8000, date: '12 Jul 2026', method: PaymentMethod.card, transactionId: 'TXN-7741-9802'),
];
