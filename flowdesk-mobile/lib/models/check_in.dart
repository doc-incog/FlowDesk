import 'role.dart';

enum CheckInStatus { onTime, late, absent }

enum CheckInMethod { biometric, webauthn, manual }

class CheckInRecord {
  const CheckInRecord({
    required this.id,
    required this.name,
    required this.role,
    required this.time,
    required this.status,
    required this.method,
  });

  final String id;
  final String name;
  final Role role;
  final String time;
  final CheckInStatus status;
  final CheckInMethod method;

  CheckInRecord copyWith({
    String? id,
    String? name,
    Role? role,
    String? time,
    CheckInStatus? status,
    CheckInMethod? method,
  }) {
    return CheckInRecord(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
      time: time ?? this.time,
      status: status ?? this.status,
      method: method ?? this.method,
    );
  }
}

extension CheckInStatusX on CheckInStatus {
  String get label => switch (this) {
        CheckInStatus.onTime => 'On time',
        CheckInStatus.late => 'Late',
        CheckInStatus.absent => 'Absent',
      };
}

extension CheckInMethodX on CheckInMethod {
  String get label => switch (this) {
        CheckInMethod.biometric => 'Biometric',
        CheckInMethod.webauthn => 'WebAuthn',
        CheckInMethod.manual => 'Manual',
      };
}
