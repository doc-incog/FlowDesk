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
      final location = state.matchedLocation;
      const publicRoutes = {'/', '/apply'};
      final isPublic = publicRoutes.contains(location);

      if (location == '/' && user != null) return '/dashboard';
      if (!isPublic && user == null) return '/';
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
