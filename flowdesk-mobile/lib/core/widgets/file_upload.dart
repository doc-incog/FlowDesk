import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

const _sampleFiles = [
  'marksheet.pdf',
  'income_certificate.pdf',
  'id_proof.pdf',
  'recommendation.pdf',
  'statement.pdf',
];

/// Records a file name only (no real upload) — mirrors the web's MockFileUpload.
class MockFileUpload extends StatelessWidget {
  const MockFileUpload({super.key, required this.onSelect, this.label = 'Attach a file'});

  final ValueChanged<String> onSelect;
  final String label;

  Future<void> _pick(BuildContext context) async {
    final result = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
            for (final f in _sampleFiles)
              ListTile(
                leading: const Icon(Icons.insert_drive_file_outlined, size: 20),
                title: Text(f),
                onTap: () => Navigator.of(ctx).pop(f),
              ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: FilledButton.tonal(
                onPressed: () async {
                  final custom = await _customName(ctx);
                  if (custom != null && custom.isNotEmpty && ctx.mounted) {
                    Navigator.of(ctx).pop(custom);
                  }
                },
                child: const Text('Type a custom file name…'),
              ),
            ),
          ],
        ),
      ),
    );
    if (result != null) onSelect(result);
  }

  Future<String?> _customName(BuildContext context) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('File name'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'e.g. document.pdf'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Attach'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return InkWell(
      onTap: () => _pick(context),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: scheme.outline, width: 1.2),
          color: scheme.surfaceContainerLow,
        ),
        child: Column(
          children: [
            Icon(Icons.cloud_upload_outlined, color: colors.chart1, size: 22),
            const SizedBox(height: 6),
            Text(label, style: TextStyle(color: colors.chart1, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
