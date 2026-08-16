/// A persisted, user-editable role definition. Mirrors the web app's roles
/// table: key is stable, label/blurb/sections are editable. Built-in roles
/// cannot be deleted.
class RoleDefinition {
  const RoleDefinition({
    required this.key,
    required this.label,
    required this.blurb,
    required this.builtin,
    required this.sections,
  });

  final String key;
  final String label;
  final String blurb;
  final bool builtin;
  final Set<String> sections;

  RoleDefinition copyWith({String? label, String? blurb, Set<String>? sections}) =>
      RoleDefinition(
        key: key,
        label: label ?? this.label,
        blurb: blurb ?? this.blurb,
        builtin: builtin,
        sections: sections ?? this.sections,
      );

  Map<String, dynamic> toJson() => {
        'key': key,
        'label': label,
        'blurb': blurb,
        'builtin': builtin,
        'sections': sections.toList(),
      };

  factory RoleDefinition.fromJson(Map<String, dynamic> json) => RoleDefinition(
        key: json['key'] as String,
        label: json['label'] as String,
        blurb: json['blurb'] as String,
        builtin: json['builtin'] as bool,
        sections: (json['sections'] as List<dynamic>).cast<String>().toSet(),
      );
}
