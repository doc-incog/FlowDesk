import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/glass.dart';
import '../../core/widgets/theme_toggle.dart';
import '../../models/role.dart';
import '../../providers/auth_controller.dart';
import '../../providers/notifications_controller.dart';
import '../../providers/roles_controller.dart';
import '../chat/ai_chat.dart';
import 'section.dart';
import 'sections/admissions_section.dart';
import 'sections/assignments_section.dart';
import 'sections/check_in_section.dart';
import 'sections/directory_section.dart';
import 'sections/exams_section.dart';
import 'sections/feedback_section.dart';
import 'sections/fees_section.dart';
import 'sections/helpdesk_section.dart';
import 'sections/mentor_section.dart';
import 'sections/notifications_section.dart';
import 'sections/overview_section.dart';
import 'sections/profile_section.dart';
import 'sections/roles_section.dart';
import 'sections/schedule_section.dart';
import 'sections/scholarships_section.dart';
import 'sections/chat_section.dart';

class DashboardShell extends ConsumerStatefulWidget {
  const DashboardShell({super.key});

  @override
  ConsumerState<DashboardShell> createState() => _DashboardShellState();
}

class _DashboardShellState extends ConsumerState<DashboardShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  SectionId _active = SectionId.overview;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider);
    final unread = ref.watch(notificationsProvider).where((n) => n.unread).length;
    final scheme = Theme.of(context).colorScheme;

    if (user == null) {
      return const SizedBox.shrink();
    }

    final rolesData = ref.watch(rolesProvider);
    final sections = rolesData.effectiveSections(user.roleKeyValue, user.id);
    final navItems =
        SectionId.values.where((s) => sections.contains(s.key)).toList();
    final active = navItems.contains(_active)
        ? _active
        : (navItems.isNotEmpty ? navItems.first : SectionId.overview);
    final roleLabel = rolesData.labelFor(user.roleKeyValue) ?? user.role.label;
    final canSeeNotifications = sections.contains(SectionId.notifications.key);

    final isWide = Breakpoints.isWide(context);
    final isTablet = Breakpoints.isTablet(context);
    final showRail = isTablet || isWide;

    final sectionWidget = _buildSection(user, active);

    void onSelect(SectionId s) {
      setState(() => _active = s);
      _scaffoldKey.currentState?.closeDrawer();
    }

    void onLogout() {
      ref.read(authProvider.notifier).logout();
      context.go('/');
    }

    if (showRail) {
      return Scaffold(
        body: Row(
          children: [
            _NavigationRail(
              navItems: navItems,
              active: active,
              unread: unread,
              onSelect: onSelect,
            ),
            Expanded(
              child: Column(
                children: [
                  _TabletAppBar(
                    roleLabel: roleLabel,
                    user: user,
                    unread: unread,
                    canSeeNotifications: canSeeNotifications,
                    onNotifications: () => setState(() => _active = SectionId.notifications),
                    onProfile: () => setState(() => _active = SectionId.profile),
                    onLogout: onLogout,
                  ),
                  Expanded(
                    child: AmbientBackground(
                      child: SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(isWide ? 32 : 20, 16, isWide ? 32 : 20, 96),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: isWide ? 1100 : 800),
                          child: sectionWidget,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Positioned(right: 16, bottom: 16, child: AIChat()),
          ],
        ),
      );
    }

    return Scaffold(
      key: _scaffoldKey,
      drawer: _DrawerContent(
        user: user,
        navItems: navItems,
        active: active,
        unread: unread,
        onSelect: onSelect,
        onLogout: onLogout,
      ),
      appBar: AppBar(
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
          tooltip: 'Open menu',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(roleLabel, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text('workspace',
                style: TextStyle(
                    fontSize: 11, color: scheme.onSurfaceVariant, height: 1)),
          ],
        ),
        actions: [
          IconButton(
            onPressed: canSeeNotifications
                ? () => setState(() => _active = SectionId.notifications)
                : null,
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            tooltip: 'Notifications',
          ),
          const ThemeToggle(),
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 12),
            child: Center(
              child: GestureDetector(
                onTap: () => setState(() => _active = SectionId.profile),
                child: Avatar(initials: user.avatarInitials, size: 34),
              ),
            ),
          ),
        ],
      ),
      body: AmbientBackground(
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 980),
                child: sectionWidget,
              ),
            ),
            const Positioned(right: 16, bottom: 16, child: AIChat()),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(dynamic user, SectionId active) {
    final role = user.role as Role;
    switch (active) {
      case SectionId.overview:
        return OverviewSection(role: role, onNavigate: (s) => setState(() => _active = s));
      case SectionId.checkin:
        return CheckInSection(role: role, userName: user.name);
      case SectionId.notifications:
        return const NotificationsSection();
      case SectionId.students:
        return DirectorySection(kind: DirectoryKind.students, role: role);
      case SectionId.staff:
        return DirectorySection(kind: DirectoryKind.staff, role: role);
      case SectionId.mentor:
        return MentorSection(role: role, mentorId: user.mentorId);
      case SectionId.chat:
        return const ChatSection();
      case SectionId.schedule:
        return ScheduleSection(role: role);
      case SectionId.exams:
        return ExamsSection(role: role);
      case SectionId.assignments:
        return AssignmentsSection(role: role);
      case SectionId.fees:
        return const FeesSection();
      case SectionId.scholarships:
        return ScholarshipsSection(role: role);
      case SectionId.admissions:
        return const AdmissionsSection();
      case SectionId.helpdesk:
        return HelpdeskSection(role: role, currentUserName: user.name);
      case SectionId.feedback:
        return const FeedbackSection();
      case SectionId.profile:
        return const ProfileSection();
      case SectionId.accessControl:
        return const RolesSection();
    }
  }
}

/// NavigationRail for tablet / wide layouts.
class _NavigationRail extends StatelessWidget {
  const _NavigationRail({
    required this.navItems,
    required this.active,
    required this.unread,
    required this.onSelect,
  });

  final List<SectionId> navItems;
  final SectionId active;
  final int unread;
  final ValueChanged<SectionId> onSelect;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;

    return Container(
      width: 72,
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(right: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: colors.chart1,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.apartment_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                for (final item in navItems)
                  _RailItem(
                    item: item,
                    isActive: item == active,
                    badge: item == SectionId.notifications && unread > 0 ? unread : null,
                    onTap: () => onSelect(item),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RailItem extends StatelessWidget {
  const _RailItem({
    required this.item,
    required this.isActive,
    this.badge,
    required this.onTap,
  });

  final SectionId item;
  final bool isActive;
  final int? badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? colors.chart1.withValues(alpha: 0.10) : null,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Badge(
                isLabelVisible: badge != null,
                label: badge != null ? Text('$badge') : null,
                child: Icon(item.icon,
                    size: 22,
                    color: isActive ? colors.chart1 : Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 3),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                  color: isActive ? colors.chart1 : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// AppBar for tablet / wide layouts.
class _TabletAppBar extends StatelessWidget {
  const _TabletAppBar({
    required this.roleLabel,
    required this.user,
    required this.unread,
    required this.canSeeNotifications,
    required this.onNotifications,
    required this.onProfile,
    required this.onLogout,
  });

  final String roleLabel;
  final dynamic user;
  final int unread;
  final bool canSeeNotifications;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Row(
        children: [
          Text(roleLabel,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(width: 6),
          Text('workspace',
              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          const Spacer(),
          IconButton(
            onPressed: canSeeNotifications ? onNotifications : null,
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined, size: 22),
            ),
            tooltip: 'Notifications',
          ),
          const ThemeToggle(),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: onProfile,
            child: Avatar(initials: user.avatarInitials, size: 32),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: onLogout,
            icon: Icon(Icons.logout_rounded, size: 20, color: scheme.error),
            tooltip: 'Sign out',
          ),
        ],
      ),
    );
  }
}

class _DrawerContent extends StatelessWidget {
  const _DrawerContent({
    required this.user,
    required this.navItems,
    required this.active,
    required this.unread,
    required this.onSelect,
    required this.onLogout,
  });

  final dynamic user;
  final List<SectionId> navItems;
  final SectionId active;
  final int unread;
  final ValueChanged<SectionId> onSelect;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;

    return Drawer(
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            decoration: BoxDecoration(
              color: colors.chart1.withValues(alpha: 0.06),
              border: Border(
                bottom: BorderSide(color: scheme.outlineVariant),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: colors.chart1,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.apartment_rounded,
                          color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Text('FlowDesk',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Avatar(initials: user.avatarInitials, size: 40),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(user.id,
                              style: TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: scheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                for (final item in navItems)
                  ListTile(
                    dense: true,
                    leading: Icon(item.icon, size: 20),
                    title: Text(item.labelFor(user.role),
                        style: const TextStyle(fontSize: 14)),
                    trailing: item == SectionId.notifications && unread > 0
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: colors.chart1,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text('$unread',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700)),
                          )
                        : null,
                    selected: item == active,
                    selectedTileColor: colors.chart1.withValues(alpha: 0.08),
                    selectedColor: colors.chart1,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    onTap: () => onSelect(item),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                OutlinedButton.icon(
                  onPressed: onLogout,
                  icon: const Icon(Icons.logout_rounded, size: 18),
                  label: const Text('Sign out'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                    side: BorderSide(color: scheme.error.withValues(alpha: 0.4)),
                    foregroundColor: scheme.error,
                  ),
                ),
                const SizedBox(height: 8),
                Text('FlowDesk v0.1 · demo',
                    style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
