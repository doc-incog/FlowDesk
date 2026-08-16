import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/glass.dart';
import '../../core/widgets/theme_toggle.dart';
import '../../data/mock_data.dart' as mock;
import '../../models/role.dart';
import '../../providers/auth_controller.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _email;
  late final TextEditingController _password;
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: mock.demoUsers[Role.student]!.email);
    _password = TextEditingController(text: 'campus123');
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final ok = ref.read(authProvider.notifier).login(_email.text, _password.text);
    if (!mounted) return;
    if (ok) {
      context.go('/dashboard');
    } else {
      setState(() {
        _submitting = false;
        _error =
            'Invalid credentials. Use a registered campus email, or the admin credentials shown below.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    final theme = Theme.of(context);

    return Scaffold(
      body: AmbientBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: colors.chart1,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.apartment_rounded,
                                  color: Colors.white, size: 24),
                            ),
                            const SizedBox(width: 12),
                            const Text('FlowDesk',
                                style: TextStyle(
                                    fontSize: 22, fontWeight: FontWeight.w600)),
                          ],
                        ),
                        const ThemeToggle(),
                      ],
                    ),
                    const SizedBox(height: 40),
                    Text(
                      'One platform for your entire campus.',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Attendance, notices, mentors and routines — unified for students, staff and administrators.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 28),
                    GlassCard(
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('Sign in',
                                style: theme.textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text('Enter your campus email to continue.',
                                style: theme.textTheme.bodySmall
                                    ?.copyWith(color: scheme.onSurfaceVariant)),
                            const SizedBox(height: 18),
                            TextFormField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.username],
                              decoration: const InputDecoration(
                                labelText: 'Campus ID / Email',
                                prefixIcon: Icon(Icons.alternate_email_rounded, size: 18),
                              ),
                              validator: (v) =>
                                  (v == null || v.trim().isEmpty) ? 'Email is required' : null,
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _password,
                              obscureText: true,
                              autofillHints: const [AutofillHints.password],
                              decoration: const InputDecoration(
                                labelText: 'Password',
                                prefixIcon: Icon(Icons.lock_outline_rounded, size: 18),
                              ),
                              onFieldSubmitted: (_) => _submit(),
                              validator: (v) =>
                                  (v == null || v.isEmpty) ? 'Password is required' : null,
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: scheme.error.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                      color: scheme.error.withValues(alpha: 0.3)),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.error_outline,
                                        size: 16, color: scheme.error),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(_error!,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(color: scheme.error)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 18),
                            FilledButton(
                              onPressed: _submitting ? null : _submit,
                              child: _submitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Text('Sign in'),
                            ),
                            const SizedBox(height: 18),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: scheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Demo credentials',
                                      style: theme.textTheme.labelMedium
                                          ?.copyWith(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 8),
                                  _CredentialLine(
                                    label: 'Student',
                                    value: mock.demoUsers[Role.student]!.email,
                                  ),
                                  const SizedBox(height: 4),
                                  _CredentialLine(
                                    label: 'Staff',
                                    value: mock.demoUsers[Role.staff]!.email,
                                  ),
                                  const SizedBox(height: 4),
                                  _CredentialLine(
                                    label: 'Admin',
                                    value:
                                        '${mock.adminCreds.email} / ${mock.adminCreds.password}',
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text.rich(
                              textAlign: TextAlign.center,
                              TextSpan(
                                text: 'New to the campus? ',
                                style: theme.textTheme.bodySmall,
                                children: [
                                  WidgetSpan(
                                    alignment: PlaceholderAlignment.middle,
                                    child: GestureDetector(
                                      onTap: () => context.go('/apply'),
                                      child: Text(
                                        'Apply for admission',
                                        style: theme.textTheme.bodySmall?.copyWith(
                                          color: colors.chart1,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CredentialLine extends StatelessWidget {
  const _CredentialLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    return RichText(
      text: TextSpan(
        style: theme.textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
        children: [
          TextSpan(text: '$label — ', style: const TextStyle(fontWeight: FontWeight.w700)),
          TextSpan(
            text: value,
            style: TextStyle(
              fontFamily: 'monospace',
              color: scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}
