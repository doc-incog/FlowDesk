class ScheduleSlot {
  const ScheduleSlot({
    required this.id,
    required this.day,
    required this.start,
    required this.end,
    required this.module,
    required this.code,
    required this.room,
    required this.staff,
  });

  final String id;
  final String day;
  final String start;
  final String end;
  final String module;
  final String code;
  final String room;
  final String staff;

  Map<String, dynamic> toJson() => {
        'id': id,
        'day': day,
        'start': start,
        'end': end,
        'module': module,
        'code': code,
        'room': room,
        'staff': staff,
      };

  factory ScheduleSlot.fromJson(Map<String, dynamic> json) => ScheduleSlot(
        id: json['id'] as String,
        day: json['day'] as String,
        start: json['start'] as String,
        end: json['end'] as String,
        module: json['module'] as String,
        code: json['code'] as String,
        room: json['room'] as String,
        staff: json['staff'] as String,
      );

  ScheduleSlot copyWith({
    String? day,
    String? start,
    String? end,
    String? module,
    String? code,
    String? room,
    String? staff,
  }) {
    return ScheduleSlot(
      id: id,
      day: day ?? this.day,
      start: start ?? this.start,
      end: end ?? this.end,
      module: module ?? this.module,
      code: code ?? this.code,
      room: room ?? this.room,
      staff: staff ?? this.staff,
    );
  }
}
