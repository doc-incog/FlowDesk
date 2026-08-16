import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/glass.dart';
import '../../../core/widgets/modal.dart';
import '../../../core/widgets/tabs.dart';
import '../../../features/dashboard/section.dart';
import '../../../models/role_definition.dart';
import '../../../models/user.dart';
import '../../../providers/directory_controller.dart';
import '../../../providers/roles_controller.dart';
import 'widgets.dart';

enum _RolesTab { roles, overrides }

class RolesSection extends ConsumerStatefulWidget {
  const RolesSection({super.key});

  @override
  ConsumerState<RolesSection> createState() => _RolesSectionState();
}

class _RolesSectionState extends ConsumerState<RolesSection> {
  _RolesTab _tab = _RolesTab.roles;
  String _query = '';

  Future<void> _openRoleForm({RoleDefinition? existing}) async {
    final saved = await showAppModal<RoleDefinition?>(
      context: context,
      title: existing == null ? 'New role' : 'Edit role',
      child: _RoleForm(existing: existing, allSections: SectionId.values),
    );
    if (saved != null && mounted) {
      ref.read(rolesProvider.notifier).saveRole(saved);
    }
  }

  Future<void> _deleteRole(RoleDefinition role) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete role?'),
        content: Text('${role.label} will be removed. Users assigned to it '
            'keep their account but lose their permission defaults.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (confirm == true && mounted) {
      ref.read(rolesProvider.notifier).deleteRole(role.key);
    }
  }

  Future<void> _openOverride(UserProfile person) async {
    await showAppModal(
      context: context,
      title: 'Permissions — ${person.name}',
      child: _OverrideForm(person: person),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(rolesProvider);
    final scheme = Theme.of(context).colorScheme;

    final tabs = [_RolesTab.roles, _RolesTab.overrides];
    String tabLabel(_RolesTab t) =>
        t == _RolesTab.roles ? 'Roles' : 'Per-user overrides';

    return SectionScaffold(
      title: 'Roles & Permissions',
      description: 'Define what each role — or a specific person — can see in the dashboard.',
      children: [
        SectionTabs(
          tabs: tabs,
          active: _tab,
          onChanged: (t) => setState(() => _tab = t),
          labels: tabLabel,
        ),
        if (_tab == _RolesTab.roles) ...[
          GlassCard(
            color: scheme.primary.withValues(alpha: 0.06),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(Icons.lock_outline_rounded, size: 18, color: scheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Sections checked for a role apply to everyone assigned to '
                    'it. Built-in roles can be renamed or re-scoped but not deleted.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          for (final r in data.roles)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(r.label,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 15)),
                        ),
                        if (r.builtin)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: scheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text('built-in',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: scheme.onSurfaceVariant,
                                    fontWeight: FontWeight.w600)),
                          ),
                        IconButton(
                          onPressed: () => _openRoleForm(existing: r),
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          tooltip: 'Edit role',
                        ),
                        if (!r.builtin)
                          IconButton(
                            onPressed: () => _deleteRole(r),
                            icon: const Icon(Icons.delete_outline, size: 18,
                                color: Colors.redAccent),
                            tooltip: 'Delete role',
                          ),
                      ],
                    ),
                    Text(r.key,
                        style: TextStyle(
                            fontSize: 12,
                            fontFamily: 'monospace',
                            color: scheme.onSurfaceVariant)),
                    if (r.blurb.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(r.blurb, style: Theme.of(context).textTheme.bodySmall),
                    ],
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final s in SectionId.values)
                          if (r.sections.contains(s.key))
                            _sectionChip(context, s.label, filled: true),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _openRoleForm(),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('New role'),
            ),
          ),
        ],
        if (_tab == _RolesTab.overrides) ...[
          TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: const InputDecoration(
              hintText: 'Search people by name or ID…',
              prefixIcon: Icon(Icons.search_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 4),
          for (final p in _filteredPeople())
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                onTap: () => _openOverride(p),
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Avatar(initials: p.avatarInitials, size: 36),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name,
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          Text(
                            _personSubtitle(p),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    if (data.overrides.containsKey(p.id))
                      Text('custom',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: scheme.primary)),
                    Icon(Icons.chevron_right_rounded,
                        color: scheme.onSurfaceVariant),
                  ],
                ),
              ),
            ),
          if (_filteredPeople().isEmpty)
            const GlassCard(child: EmptyState(message: 'No one matches your search.')),
        ],
      ],
    );
  }

  List<UserProfile> _filteredPeople() {
    final people = ref.read(directoryProvider).allPeople;
    if (_query.isEmpty) return people;
    final q = _query.toLowerCase();
    return people
        .where((p) =>
            p.name.toLowerCase().contains(q) || p.id.toLowerCase().contains(q))
        .toList();
  }

  String _personSubtitle(UserProfile p) {
    final data = ref.read(rolesProvider);
    final role = data.labelFor(p.roleKeyValue) ?? p.role.label;
    return '$role · ${p.id}';
  }

  Widget _sectionChip(BuildContext context, String label, {required bool filled}) {
    final scheme = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: filled ? colors.chart1.withValues(alpha: 0.1) : scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 12, color: filled ? colors.chart1 : scheme.onSurfaceVariant)),
    );
  }
}

class _RoleForm extends StatefulWidget {
  const _RoleForm({this.existing, required this.allSections});

  final RoleDefinition? existing;
  final List<SectionId> allSections;

  @override
  State<_RoleForm> createState() => _RoleFormState();
}

class _RoleFormState extends State<_RoleForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _key;
  late final TextEditingController _label;
  late final TextEditingController _blurb;
  late final Set<String> _selected;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _key = TextEditingController(text: e?.key ?? '');
    _label = TextEditingController(text: e?.label ?? '');
    _blurb = TextEditingController(text: e?.blurb ?? '');
    _selected = Set.of(e?.sections ?? const {});
  }

  @override
  void dispose() {
    _key.dispose();
    _label.dispose();
    _blurb.dispose();
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final key = _key.text.trim().toLowerCase();
    final role = widget.existing?.copyWith(
      label: _label.text.trim(),
      blurb: _blurb.text.trim(),
      sections: _selected,
    ) ??
        RoleDefinition(
          key: key,
          label: _label.text.trim(),
          blurb: _blurb.text.trim(),
          builtin: false,
          sections: _selected,
        );
    Navigator.of(context).pop(role);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _key,
            enabled: !_isEdit,
            decoration: const InputDecoration(labelText: 'Key'),
            validator: (v) {
              final value = v?.trim() ?? '';
              if (value.isEmpty) return 'Key is required';
              if (!RegExp(r'^[a-z_]+$').hasMatch(value)) {
                return 'Use lowercase letters and underscores';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _label,
            decoration: const InputDecoration(labelText: 'Display label'),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Label is required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _blurb,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          const SizedBox(height: 16),
          const Text('Dashboard access',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                for (final s in widget.allSections)
                  CheckboxListTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(s.label, style: const TextStyle(fontSize: 13)),
                    value: _selected.contains(s.key),
                    onChanged: (v) => setState(() {
                      if (v == true) {
                        _selected.add(s.key);
                      } else {
                        _selected.remove(s.key);
                      }
                    }),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _save,
            child: Text(_isEdit ? 'Save role' : 'Create role'),
          ),
        ],
      ),
    );
  }
}

class _OverrideForm extends ConsumerStatefulWidget {
  const _OverrideForm({required this.person});

  final UserProfile person;

  @override
  ConsumerState<_OverrideForm> createState() => _OverrideFormState();
}

class _OverrideFormState extends ConsumerState<_OverrideForm> {
  late bool _custom;
  late final Set<String> _selected;
  late final Set<String> _roleDefault;

  @override
  void initState() {
    super.initState();
    final data = ref.read(rolesProvider);
    _roleDefault = data.effectiveSections(
      widget.person.roleKeyValue,
      widget.person.id,
    );
    // start from the current effective value so edits are incremental
    final override = data.overrides[widget.person.id];
    _custom = override != null;
    _selected = Set.of(override ?? _roleDefault);
  }

  void _save() {
    ref.read(rolesProvider.notifier)
        .setOverride(widget.person.id, _custom ? _selected : null);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Role default: ${ref.read(rolesProvider).labelFor(widget.person.roleKeyValue) ?? widget.person.role.label}',
          style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Custom sections',
              style: TextStyle(fontWeight: FontWeight.w600)),
          subtitle: const Text('Off = follow the role defaults'),
          value: _custom,
          onChanged: (v) => setState(() => _custom = v),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              for (final s in SectionId.values)
                CheckboxListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(s.label, style: const TextStyle(fontSize: 13)),
                  value: _custom ? _selected.contains(s.key) : _roleDefault.contains(s.key),
                  onChanged: _custom
                      ? (v) => setState(() {
                            if (v == true) {
                              _selected.add(s.key);
                            } else {
                              _selected.remove(s.key);
                            }
                          })
                      : null,
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: _save,
          child: const Text('Save permissions'),
        ),
      ],
    );
  }
}
