import 'package:flutter/material.dart';

import '../../models/role.dart';

enum SectionId {
  overview('Overview', Icons.space_dashboard_outlined, {Role.student, Role.staff, Role.admin}),
  checkin('Check-in', Icons.fingerprint_rounded, {Role.student, Role.staff, Role.admin}),
  notifications('Notifications', Icons.notifications_outlined, {Role.student, Role.staff, Role.admin}),
  students('Students', Icons.school_outlined, {Role.staff, Role.admin}),
  staff('Staff', Icons.groups_outlined, {Role.admin}),
  mentor('Mentor', Icons.person_outline_rounded, {Role.student, Role.staff}),
  schedule('Schedule', Icons.calendar_month_outlined, {Role.student, Role.staff, Role.admin}),
  exams('Exams & Results', Icons.assignment_outlined, {Role.student, Role.staff, Role.admin}),
  assignments('Assignments', Icons.description_outlined, {Role.student, Role.staff, Role.admin}),
  fees('Online Fees', Icons.credit_card_outlined, {Role.student, Role.admin}),
  scholarships('Scholarships', Icons.emoji_events_outlined, {Role.student, Role.admin}),
  admissions('Admissions', Icons.fact_check_outlined, {Role.admin}),
  helpdesk('Helpdesk', Icons.support_agent_outlined, {Role.student, Role.staff, Role.admin}),
  feedback('Feedback', Icons.rate_review_outlined, {Role.student, Role.staff, Role.admin});

  const SectionId(this.label, this.icon, this.roles);

  final String label;
  final IconData icon;
  final Set<Role> roles;

  String labelFor(Role role) =>
      this == SectionId.mentor ? (role == Role.staff ? 'Mentees' : 'My Mentor') : label;
}
