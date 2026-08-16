import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/apply/apply_page.dart';
import '../features/auth/login_page.dart';
import '../features/dashboard/dashboard_shell.dart';
import 'auth_controller.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final user = ref.read(authProvider);
      final isLogin = state.matchedLocation == '/';
      final isApply = state.matchedLocation == '/apply';

      if (isLogin && user != null) return '/dashboard';
      if (state.matchedLocation == '/dashboard' && user == null) return '/';
      if (isApply && user != null) return null;
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/dashboard', builder: (context, state) => const DashboardShell()),
      GoRoute(path: '/apply', builder: (context, state) => const ApplyPage()),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
