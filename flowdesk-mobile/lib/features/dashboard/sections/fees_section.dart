import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/utils/pdf_export.dart';
import '../../../core/utils/responsive.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/modal.dart';
import '../../../core/widgets/section_heading.dart';
import '../../../core/widgets/tabs.dart';
import '../../../data/mock_data.dart' as mock;
import '../../../models/fee.dart';
import '../../../models/role.dart';
import '../../../providers/fees_controller.dart';
import 'widgets.dart';

enum _FeesTab { dues, receipts }

class FeesSection extends ConsumerStatefulWidget {
  const FeesSection({super.key});

  @override
  ConsumerState<FeesSection> createState() => _FeesSectionState();
}

class _FeesSectionState extends ConsumerState<FeesSection> {
  _FeesTab _tab = _FeesTab.dues;

  void _startPay(FeeItem fee) {
    showAppModal(
      context: context,
      title: 'Pay — ${fee.name}',
      child: _PaymentSheet(fee: fee),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feesProvider);
    final pending =
        state.items.where((f) => f.status == FeeStatus.pending).toList();
    final paid =
        state.items.where((f) => f.status == FeeStatus.paid).toList();
    final totalDue = pending.fold<int>(0, (s, f) => s + f.amount);
    final totalPaid = paid.fold<int>(0, (s, f) => s + f.amount);
    final colors = Theme.of(context).extension<AppColors>()!;

    return SectionScaffold(
      title: 'Online Fees',
      description:
          'Pay semester dues instantly — e-wallet, card or net banking. Digital receipts are generated automatically.',
      children: [
        CardGrid(children: [
          StatCard(
              label: 'Total due',
              value: formatINR(totalDue),
              tone: colors.warning,
              icon: Icons.account_balance_wallet_outlined),
          StatCard(
              label: 'Paid this semester',
              value: formatINR(totalPaid),
              tone: colors.success,
              icon: Icons.verified_outlined),
          StatCard(
              label: 'Pending items',
              value: '${pending.length}',
              tone: colors.chart1,
              icon: Icons.receipt_long_outlined),
        ]),
        SectionTabs(
          tabs: const [_FeesTab.dues, _FeesTab.receipts],
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: (t) => t == _FeesTab.dues ? 'Fee dues' : 'Receipts',
        ),
        switch (_tab) {
          _FeesTab.dues => _DuesTable(
              items: state.items,
              colors: colors,
              onPay: _startPay,
            ),
          _FeesTab.receipts => _ReceiptsList(receipts: state.receipts),
        },
      ],
    );
  }
}

enum _PayStep { method, processing, success }

class _PaymentSheet extends ConsumerStatefulWidget {
  const _PaymentSheet({required this.fee});

  final FeeItem fee;

  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  _PayStep _step = _PayStep.method;
  PaymentMethod _method = PaymentMethod.ewallet;
  Receipt? _newReceipt;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _confirm() {
    setState(() => _step = _PayStep.processing);
    _timer = Timer(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      final result =
          ref.read(feesProvider.notifier).pay(widget.fee, _method);
      setState(() {
        _newReceipt = result.receipts.first;
        _step = _PayStep.success;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final fee = widget.fee;

    switch (_step) {
      case _PayStep.method:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Amount to pay',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                    color: scheme.onSurfaceVariant)),
                        Text(formatINR(fee.amount),
                            style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: colors.chart1)),
                      ],
                    ),
                  ),
                  Icon(Icons.lock_outline_rounded,
                      size: 20, color: scheme.onSurfaceVariant),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text('Choose payment method',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (final m in const [
              (PaymentMethod.ewallet, 'E-Wallet', Icons.account_balance_wallet_rounded,
                  'eSewa, Khalti, IME Pay'),
              (PaymentMethod.card, 'Card', Icons.credit_card_rounded, 'Visa, Mastercard'),
              (PaymentMethod.netbanking, 'Net Banking',
                  Icons.account_balance_rounded, 'All major banks'),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => setState(() => _method = m.$1),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color:
                            _method == m.$1 ? colors.chart1 : scheme.outline,
                        width: _method == m.$1 ? 1.5 : 1,
                      ),
                      color: _method == m.$1
                          ? colors.chart1.withValues(alpha: 0.05)
                          : Colors.transparent,
                    ),
                    child: Row(
                      children: [
                        Icon(m.$3, size: 20, color: colors.chart1),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m.$2,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              Text(m.$4,
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: scheme.onSurfaceVariant)),
                            ],
                          ),
                        ),
                        if (_method == m.$1)
                          Icon(Icons.check_circle_rounded,
                              size: 18, color: colors.chart1),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                border: Border.all(
                    color: scheme.outline, style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'This is a simulated payment — no real money is moved. The receipt is generated instantly.',
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: _confirm,
              icon: const Icon(Icons.lock_outline_rounded, size: 18),
              label: Text('Pay ${formatINR(fee.amount)} securely'),
            ),
          ],
        );
      case _PayStep.processing:
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Column(
            children: [
              SizedBox(
                width: 44,
                height: 44,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: CircularProgressIndicator(
                          strokeWidth: 3, color: colors.chart1),
                    ),
                    Icon(Icons.wallet_rounded,
                        color: colors.chart1, size: 20),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Text('Processing payment…',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text("Please don't close this window.",
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: scheme.onSurfaceVariant)),
            ],
          ),
        );
      case _PayStep.success:
        final r = _newReceipt!;
        return SuccessPanel(
          title: 'Payment received',
          subtitle: '${formatINR(r.amount)} · ${r.method.label}',
          trailing: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    _Row('Receipt', r.id, mono: true),
                    _Row('Transaction', r.transactionId, mono: true),
                    _Row('Date', r.date),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () async {
                  final me = mock.demoUsers[Role.student]!;
                  await exportReceipt(ReceiptData(
                    receiptId: r.id,
                    studentName: r.studentName,
                    rollNo: me.rollNo ?? r.studentId,
                    transactionId: r.transactionId,
                    itemName: r.itemName,
                    amount: r.amount,
                    date: r.date,
                    methodLabel: r.method.label,
                  ));
                },
                icon: const Icon(Icons.download_rounded, size: 18),
                label: const Text('Download receipt'),
              ),
            ],
          ),
        );
    }
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.mono = false});

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style:
                  TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
          Text(value,
              style: TextStyle(
                  fontFamily: mono ? 'monospace' : null,
                  fontSize: 13,
                  fontWeight: mono ? FontWeight.w700 : FontWeight.w500)),
        ],
      ),
    );
  }
}

/// Responsive dues display — card list on compact, table on medium+.
class _DuesTable extends StatelessWidget {
  const _DuesTable({
    required this.items,
    required this.colors,
    required this.onPay,
  });

  final List<FeeItem> items;
  final AppColors colors;
  final ValueChanged<FeeItem> onPay;

  @override
  Widget build(BuildContext context) {
    final isCompact = ResponsiveLayout.isCompact(context);
    if (isCompact) return _DuesCardList(items: items, colors: colors, onPay: onPay);
    return _DuesDataTable(items: items, colors: colors, onPay: onPay);
  }
}

class _DuesCardList extends StatelessWidget {
  const _DuesCardList({
    required this.items,
    required this.colors,
    required this.onPay,
  });

  final List<FeeItem> items;
  final AppColors colors;
  final ValueChanged<FeeItem> onPay;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();

    return Column(
      children: [
        for (final f in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(f.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700)),
                      ),
                      f.status == FeeStatus.paid
                          ? Pill(
                              text: 'Paid · ${f.method?.label ?? 'E-Wallet'}',
                              color: colors.success,
                              compact: true)
                          : _OverduePill(
                              dueDate: f.dueDate,
                              now: now,
                              colors: colors),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text(formatINR(f.amount),
                          style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700,
                              fontSize: 16)),
                      const Spacer(),
                      Text('Due: ${f.dueDate}',
                          style: TextStyle(
                              fontSize: 12,
                              color: scheme.onSurfaceVariant)),
                    ],
                  ),
                  if (f.status == FeeStatus.paid && f.receiptId != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text('Receipt: ${f.receiptId}',
                          style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              color: scheme.onSurfaceVariant)),
                    ),
                  if (f.status == FeeStatus.pending) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () => onPay(f),
                        child: const Text('Pay now'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DuesDataTable extends StatelessWidget {
  const _DuesDataTable({
    required this.items,
    required this.colors,
    required this.onPay,
  });

  final List<FeeItem> items;
  final AppColors colors;
  final ValueChanged<FeeItem> onPay;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
            child: Row(
              children: [
                Expanded(flex: 3, child: _header(context, 'Fee item')),
                Expanded(
                    flex: 2, child: _header(context, 'Amount', right: true)),
                Expanded(flex: 2, child: _header(context, 'Due date')),
                Expanded(flex: 2, child: _header(context, 'Status')),
                Expanded(
                    flex: 2,
                    child: _header(context, 'Action', right: true)),
              ],
            ),
          ),
          const Divider(height: 1),
          for (final f in items)
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                      flex: 3,
                      child: Text(f.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600))),
                  Expanded(
                    flex: 2,
                    child: Text(formatINR(f.amount),
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w700)),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(f.dueDate,
                        style: TextStyle(
                            fontSize: 12,
                            color: scheme.onSurfaceVariant)),
                  ),
                  Expanded(
                    flex: 2,
                    child: f.status == FeeStatus.paid
                        ? Pill(
                            text:
                                'Paid · ${f.method?.label ?? 'E-Wallet'}',
                            color: colors.success,
                            compact: true)
                        : _OverduePill(
                            dueDate: f.dueDate,
                            now: now,
                            colors: colors),
                  ),
                  Expanded(
                    flex: 2,
                    child: f.status == FeeStatus.paid
                        ? Text(
                            f.receiptId ?? '—',
                            textAlign: TextAlign.right,
                            style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 11,
                                color: scheme.onSurfaceVariant),
                          )
                        : Align(
                            alignment: Alignment.centerRight,
                            child: FilledButton(
                              onPressed: () => onPay(f),
                              style: FilledButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 8),
                              ),
                              child: const Text('Pay now'),
                            ),
                          ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _header(BuildContext context, String label, {bool right = false}) =>
      Text(
        label,
        textAlign: right ? TextAlign.right : TextAlign.left,
        style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.6,
            color: Theme.of(context).colorScheme.onSurfaceVariant),
      );
}

class _OverduePill extends StatelessWidget {
  const _OverduePill({
    required this.dueDate,
    required this.now,
    required this.colors,
  });

  final String dueDate;
  final DateTime now;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final isOverdue = _parseDate(dueDate).isBefore(now);
    return Pill(
      text: isOverdue ? 'Overdue' : 'Pending',
      color: isOverdue ? colors.chart4 : colors.warning,
      compact: true,
    );
  }

  DateTime _parseDate(String date) {
    try {
      return DateTime.parse(date);
    } catch (_) {
      return DateTime(2099);
    }
  }
}

/// Responsive receipts list — stacked cards on compact, rows on medium+.
class _ReceiptsList extends StatelessWidget {
  const _ReceiptsList({required this.receipts});

  final List<Receipt> receipts;

  Future<void> _download(BuildContext context, Receipt r) async {
    final me = mock.demoUsers[Role.student]!;
    await exportReceipt(ReceiptData(
      receiptId: r.id,
      studentName: r.studentName,
      rollNo: me.rollNo ?? r.studentId,
      transactionId: r.transactionId,
      itemName: r.itemName,
      amount: r.amount,
      date: r.date,
      methodLabel: r.method.label,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final isCompact = ResponsiveLayout.isCompact(context);

    if (receipts.isEmpty) {
      return const GlassCard(child: EmptyState(message: 'No receipts yet.'));
    }
    return Column(
      children: [
        for (final r in receipts)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              child: isCompact
                  ? _ReceiptCard(
                      receipt: r, colors: colors, scheme: scheme,
                      onDownload: () => _download(context, r))
                  : _ReceiptRow(
                      receipt: r, colors: colors, scheme: scheme,
                      onDownload: () => _download(context, r)),
            ),
          ),
      ],
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({
    required this.receipt,
    required this.colors,
    required this.scheme,
    required this.onDownload,
  });

  final Receipt receipt;
  final AppColors colors;
  final ColorScheme scheme;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: Icon(Icons.receipt_long_rounded,
                  size: 18, color: scheme.onSurfaceVariant),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(receipt.itemName,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Text(formatINR(receipt.amount),
                style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w700)),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          '${receipt.id} · ${receipt.transactionId} · ${receipt.date}',
          style: TextStyle(
              fontFamily: 'monospace',
              fontSize: 11,
              color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Pill(text: receipt.method.label, color: colors.chart5, compact: true),
            const Spacer(),
            IconButton(
              onPressed: onDownload,
              icon: Icon(Icons.download_rounded,
                  size: 20, color: colors.chart1),
              tooltip: 'Download receipt',
            ),
          ],
        ),
      ],
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({
    required this.receipt,
    required this.colors,
    required this.scheme,
    required this.onDownload,
  });

  final Receipt receipt;
  final AppColors colors;
  final ColorScheme scheme;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Icon(Icons.receipt_long_rounded,
              size: 22, color: scheme.onSurfaceVariant),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(receipt.itemName,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(
                '${receipt.id} · ${receipt.transactionId} · ${receipt.date}',
                style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
        Text(formatINR(receipt.amount),
            style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w700,
                fontSize: 15)),
        const SizedBox(width: 10),
        Pill(text: receipt.method.label, color: colors.chart5, compact: true),
        const SizedBox(width: 4),
        IconButton(
          onPressed: onDownload,
          icon: Icon(Icons.download_rounded,
              size: 20, color: colors.chart1),
          tooltip: 'Download receipt',
        ),
      ],
    );
  }
}
