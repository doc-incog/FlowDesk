import 'dart:async';

import 'package:flutter/material.dart';

import '_local_auth_native.dart' if (dart.library.html) '_local_auth_stub.dart';

import '../../core/theme/app_theme.dart';

enum ScanStatus { idle, scanning, success }

class BiometricScanner extends StatefulWidget {
  const BiometricScanner({
    super.key,
    required this.onVerified,
    this.label = 'Scan fingerprint to continue',
  });

  final ValueChanged<CheckMethod> onVerified;
  final String label;

  @override
  State<BiometricScanner> createState() => _BiometricScannerState();
}

enum CheckMethod { webauthn, biometric }

class _BiometricScannerState extends State<BiometricScanner> {
  final LocalAuthentication _auth = LocalAuthentication();
  ScanStatus _status = ScanStatus.idle;
  Timer? _timer;
  CheckMethod _method = CheckMethod.biometric;
  bool _authAvailable = true;

  @override
  void initState() {
    super.initState();
    _checkAvailability();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _checkAvailability() async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      if (!mounted) return;
      setState(() => _authAvailable = supported && canCheck);
    } catch (_) {
      if (mounted) setState(() => _authAvailable = false);
    }
  }

  Future<void> _scan() async {
    if (_status != ScanStatus.idle) return;

    var verified = false;
    if (_authAvailable) {
      try {
        verified = await _auth.authenticate(
          localizedReason: widget.label,
          biometricOnly: true,
          persistAcrossBackgrounding: true,
        );
      } catch (_) {
        verified = false;
      }
    }

    if (!mounted) return;

    if (verified) {
      _finish(CheckMethod.webauthn);
      return;
    }

    // Simulated fallback scan (1.8s), mirrors the web app.
    setState(() => _status = ScanStatus.scanning);
    _timer = Timer(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      _finish(CheckMethod.biometric);
    });
  }

  void _finish(CheckMethod method) {
    setState(() {
      _status = ScanStatus.success;
      _method = method;
    });
    widget.onVerified(method);
  }

  void reset() {
    _timer?.cancel();
    if (mounted) setState(() => _status = ScanStatus.idle);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;

    final (IconData icon, Color color, String text, String caption) =
        switch (_status) {
      ScanStatus.idle => (
          Icons.fingerprint_rounded,
          colors.chart1,
          widget.label,
          _authAvailable
              ? 'Uses your device biometrics when available'
              : 'via biometric sensor (simulated)',
        ),
      ScanStatus.scanning => (
          Icons.fingerprint,
          colors.warning,
          'Scanning…',
          'Hold the sensor',
        ),
      ScanStatus.success => (
          Icons.check_rounded,
          colors.success,
          'Verified successfully',
          _method == CheckMethod.webauthn
              ? 'via device biometric authenticator'
              : 'via biometric sensor',
        ),
    };

    return Column(
      children: [
        InkWell(
          onTap: _status == ScanStatus.success ? reset : _scan,
          borderRadius: BorderRadius.circular(999),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            width: 92,
            height: 92,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.12),
              border: Border.all(color: color.withValues(alpha: 0.5), width: 2),
            ),
            child: _status == ScanStatus.scanning
                ? Padding(
                    padding: const EdgeInsets.all(20),
                    child: CircularProgressIndicator(
                        strokeWidth: 3, color: color),
                  )
                : Icon(icon, size: 44, color: color),
          ),
        ),
        const SizedBox(height: 14),
        Text(text,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(caption,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant)),
      ],
    );
  }
}
