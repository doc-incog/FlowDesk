import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/glass.dart';
import '../../core/widgets/file_upload.dart';
import '../../models/admission.dart';
import '../../providers/admissions_controller.dart';

typedef _View = String; // 'apply' | 'track'

class ApplyPage extends ConsumerStatefulWidget {
  const ApplyPage({super.key});

  @override
  ConsumerState<ApplyPage> createState() => _ApplyPageState();
}

class _ApplyPageState extends ConsumerState<ApplyPage> {
  _View _view = 'apply';

  String _name = '';
  String _email = '';
  String? _programId;
  String _score = '80';
  final List<String> _docs = [];
  String? _error;
  String? _submittedId;
  String _trackId = '';

  void _submit() {
    if (_name.trim().isEmpty || _email.trim().isEmpty || _programId == null) {
      setState(() => _error = 'Name, email and programme are required.');
      return;
    }
    final programs = ref.read(programsProvider);
    final program =
        programs.where((p) => p.id == _programId).firstOrNull;
    final app = AdmissionApplication(
      id: 'APP-${DateTime.now().millisecondsSinceEpoch}',
      applicantName: _name.trim(),
      email: _email.trim(),
      programId: _programId!,
      programName: program?.name ?? '',
      score: int.tryParse(_score) ?? 0,
      docs: _docs,
      status: AdmissionStatus.submitted,
      submittedAt: formatToday(),
      notes: '',
    );
    ref.read(admissionsProvider.notifier).submit(app);
    setState(() {
      _submittedId = app.id;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final programs = ref.watch(programsProvider);
    final applications = ref.watch(admissionsProvider);
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    final trackApp = _trackId.trim().isEmpty
        ? null
        : applications
            .where((a) =>
                a.id.toLowerCase() == _trackId.trim().toLowerCase())
            .firstOrNull;

    return Scaffold(
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                decoration: BoxDecoration(
                  color: scheme.surface.withValues(alpha: 0.8),
                  border: Border(
                      bottom: BorderSide(color: scheme.outlineVariant)),
                ),
                child: Row(
                  children: [
                    InkWell(
                      onTap: () => context.go('/'),
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 6),
                        child: Row(
                          children: [
                            Icon(Icons.arrow_back_rounded,
                                size: 18, color: scheme.onSurfaceVariant),
                            const SizedBox(width: 4),
                            Text('Back to sign in',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: scheme.onSurfaceVariant)),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: colors.chart1,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.apartment_rounded,
                          color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 8),
                    const Text('FlowDesk Admissions',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 28, 16, 32),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 760),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Admissions 2026',
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Apply online to our undergraduate and postgraduate programmes. '
                            'Track your application status anytime using the application ID you receive.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: scheme.onSurfaceVariant),
                          ),
                          const SizedBox(height: 20),
                          Center(
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color:
                                    scheme.surfaceContainerHighest.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(12),
                                border:
                                    Border.all(color: scheme.outlineVariant),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _ToggleButton(
                                    label: 'Apply',
                                    icon: Icons.school_outlined,
                                    selected: _view == 'apply',
                                    onTap: () => setState(() => _view = 'apply'),
                                  ),
                                  _ToggleButton(
                                    label: 'Track status',
                                    icon: Icons.search_rounded,
                                    selected: _view == 'track',
                                    onTap: () => setState(() => _view = 'track'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 28),
                          if (_view == 'apply')
                            _buildApply(programs, colors, scheme)
                          else
                            _buildTrack(trackApp, colors, scheme),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildApply(List<Program> programs, AppColors colors, ColorScheme scheme) {
    if (_submittedId != null) {
      return Center(
        child: GlassCard(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: colors.success.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child:
                    Icon(Icons.check_rounded, color: colors.success, size: 30),
              ),
              const SizedBox(height: 14),
              Text('Application submitted',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text.rich(
                textAlign: TextAlign.center,
                TextSpan(
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: scheme.onSurfaceVariant),
                  children: [
                    const TextSpan(text: 'Your application ID is '),
                    TextSpan(
                      text: _submittedId!,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w700,
                        color: colors.chart1,
                      ),
                    ),
                    const TextSpan(
                        text: '. Save it to track your status.'),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () => setState(() {
                  _view = 'track';
                  _trackId = _submittedId!;
                }),
                child: const Text('Track status'),
              ),
            ],
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Programmes',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                Text('2026 intake options.',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: scheme.onSurfaceVariant)),
                const SizedBox(height: 12),
                for (final p in programs)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      onTap: () => setState(() => _programId = p.id),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _programId == p.id
                                ? colors.chart1
                                : scheme.outlineVariant,
                            width: _programId == p.id ? 1.5 : 1,
                          ),
                          color: _programId == p.id
                              ? colors.chart1.withValues(alpha: 0.05)
                              : scheme.surfaceContainerLow,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(p.name,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14)),
                                ),
                                if (_programId == p.id)
                                  Icon(Icons.check_circle_rounded,
                                      size: 16, color: colors.chart1),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${p.duration} · ${p.seats} seats · ${formatINR(p.fee)}/yr',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: scheme.onSurfaceVariant),
                            ),
                            const SizedBox(height: 2),
                            Text('Deadline ${p.deadline}',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: colors.chart1)),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          flex: 3,
          child: GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Application form',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 14),
                TextField(
                  onChanged: (v) => setState(() => _name = v),
                  decoration: const InputDecoration(
                      labelText: 'Full name',
                      hintText: 'e.g. Rohan Verma'),
                ),
                const SizedBox(height: 12),
                TextField(
                  onChanged: (v) => setState(() => _email = v),
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                      labelText: 'Email', hintText: 'you@example.com'),
                ),
                const SizedBox(height: 12),
                TextField(
                  onChanged: (v) => setState(() => _score = v),
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  decoration: const InputDecoration(
                      labelText: 'Entrance / qualifying score'),
                ),
                const SizedBox(height: 14),
                Text('Documents',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                MockFileUpload(
                  label: 'Attach marksheet',
                  onSelect: (name) => setState(() => _docs.add(name)),
                ),
                const SizedBox(height: 10),
                MockFileUpload(
                  label: 'Attach ID proof (optional)',
                  onSelect: (name) => setState(() => _docs.add(name)),
                ),
                if (_docs.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    '${_docs.length} document(s) attached',
                    style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!,
                      style: TextStyle(color: colors.chart4, fontSize: 13)),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.school_outlined, size: 18),
                  label: const Text('Submit application'),
                ),
                const SizedBox(height: 8),
                Text(
                  'Demo application — data is stored in your device and visible to the admin Admissions queue.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTrack(
      AdmissionApplication? trackApp, AppColors colors, ColorScheme scheme) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Track your application',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              Text('Enter the application ID you received at submission.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: scheme.onSurfaceVariant)),
              const SizedBox(height: 14),
              TextField(
                onChanged: (v) => setState(() => _trackId = v),
                decoration: const InputDecoration(
                    labelText: 'Application ID',
                    hintText: 'e.g. APP-2041'),
              ),
              if (trackApp != null) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerHighest.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(trackApp.applicantName,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(
                        '${trackApp.id} · ${trackApp.programName} · Submitted ${trackApp.submittedAt}',
                        style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _StatusBadge(status: trackApp.status, colors: colors),
                    const SizedBox(width: 10),
                    if (trackApp.status == AdmissionStatus.accepted)
                      Expanded(
                        child: Text('Congratulations — offer letter ready.',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: colors.success)),
                      ),
                    if (trackApp.status == AdmissionStatus.rejected &&
                        trackApp.notes.isNotEmpty)
                      Expanded(
                        child: Text(trackApp.notes,
                            style: TextStyle(
                                fontSize: 12, color: scheme.onSurfaceVariant)),
                      ),
                  ],
                ),
              ] else if (_trackId.trim().isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'No application found with that ID. Double-check the ID or try applying first.',
                    style: TextStyle(fontSize: 13, color: colors.warning),
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.search_rounded,
                      size: 14, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Text(
                    'Applications move through Submitted → Reviewing → Accepted/Rejected.',
                    style: TextStyle(
                        fontSize: 12, color: scheme.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(9),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? scheme.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 16,
                color: selected
                    ? Theme.of(context).extension<AppColors>()!.chart1
                    : scheme.onSurfaceVariant),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: selected ? scheme.onSurface : scheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.colors});

  final AdmissionStatus status;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      AdmissionStatus.submitted => (colors.chart1, 'Submitted'),
      AdmissionStatus.reviewing => (colors.warning, 'Reviewing'),
      AdmissionStatus.accepted => (colors.success, 'Accepted'),
      AdmissionStatus.rejected => (colors.chart4, 'Rejected'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
