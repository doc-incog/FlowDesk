import 'package:flutter/material.dart';

import '../../models/role.dart';

enum SectionId {
  overview('Overview', Icons.space_dashboard_outlined, {Role.student, Role.staff, Role.admin}, 'overview'),
  checkin('Check-in', Icons.fingerprint_rounded, {Role.student, Role.staff, Role.admin}, 'checkin'),
  notifications('Notifications', Icons.notifications_outlined, {Role.student, Role.staff, Role.admin}, 'notifications'),
  students('Students', Icons.school_outlined, {Role.staff, Role.admin}, 'students'),
  staff('Staff', Icons.groups_outlined, {Role.admin}, 'staff'),
  mentor('Mentor', Icons.person_outline_rounded, {Role.student, Role.staff}, 'mentor'),
  chat('Messages', Icons.chat_bubble_outline, {Role.student, Role.staff, Role.admin}, 'chat'),
  schedule('Schedule', Icons.calendar_month_outlined, {Role.student, Role.staff, Role.admin}, 'schedule'),
  exams('Exams & Results', Icons.assignment_outlined, {Role.student, Role.staff, Role.admin}, 'exams'),
  assignments('Assignments', Icons.description_outlined, {Role.student, Role.staff, Role.admin}, 'assignments'),
  fees('Online Fees', Icons.credit_card_outlined, {Role.student, Role.admin}, 'fees'),
  scholarships('Scholarships', Icons.emoji_events_outlined, {Role.student, Role.admin}, 'scholarships'),
  admissions('Admissions', Icons.fact_check_outlined, {Role.admin}, 'admissions'),
  helpdesk('Helpdesk', Icons.support_agent_outlined, {Role.student, Role.staff, Role.admin}, 'helpdesk'),
  feedback('Feedback', Icons.rate_review_outlined, {Role.student, Role.staff, Role.admin}, 'feedback'),
  profile('Profile', Icons.badge_outlined, {Role.student, Role.staff, Role.admin}, 'profile'),
  accessControl('Roles & Permissions', Icons.admin_panel_settings_outlined, {Role.admin}, 'roles');

  const SectionId(this.label, this.icon, this.roles, this.key);

  final String label;
  final IconData icon;

  /// Default roles that see this section when no role/permission registry
  /// override applies — mirrors the web app's seeded defaults.
  final Set<Role> roles;

  /// Stable string key shared with the web app (role_permissions table).
  final String key;

  static SectionId? fromKey(String key) {
    for (final s in SectionId.values) {
      if (s.key == key) return s;
    }
    return null;
  }

  String labelFor(Role role) =>
      this == SectionId.mentor ? (role == Role.staff ? 'Mentees' : 'My Mentor') : label;
}
