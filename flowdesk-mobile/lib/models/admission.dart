class Program {
  const Program({
    required this.id,
    required this.name,
    required this.duration,
    required this.seats,
    required this.deadline,
    required this.fee,
  });

  final String id;
  final String name;
  final String duration;
  final int seats;
  final String deadline;
  final int fee;
}

enum AdmissionStatus { submitted, reviewing, accepted, rejected }

class AdmissionApplication {
  const AdmissionApplication({
    required this.id,
    required this.applicantName,
    required this.email,
    required this.programId,
    required this.programName,
    required this.score,
    required this.docs,
    required this.status,
    required this.submittedAt,
    this.notes = '',
  });

  final String id;
  final String applicantName;
  final String email;
  final String programId;
  final String programName;
  final int score;
  final List<String> docs;
  final AdmissionStatus status;
  final String submittedAt;
  final String notes;

  Map<String, dynamic> toJson() => {
        'id': id,
        'applicantName': applicantName,
        'email': email,
        'programId': programId,
        'programName': programName,
        'score': score,
        'docs': docs,
        'status': status.name,
        'submittedAt': submittedAt,
        'notes': notes,
      };

  factory AdmissionApplication.fromJson(Map<String, dynamic> json) =>
      AdmissionApplication(
        id: json['id'] as String,
        applicantName: json['applicantName'] as String,
        email: json['email'] as String,
        programId: json['programId'] as String,
        programName: json['programName'] as String,
        score: (json['score'] as num).toInt(),
        docs: (json['docs'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
        status: AdmissionStatus.values.firstWhere(
            (s) => s.name == json['status'],
            orElse: () => AdmissionStatus.submitted),
        submittedAt: json['submittedAt'] as String,
        notes: json['notes'] as String? ?? '',
      );

  AdmissionApplication copyWith({
    AdmissionStatus? status,
    String? notes,
  }) =>
      AdmissionApplication(
        id: id,
        applicantName: applicantName,
        email: email,
        programId: programId,
        programName: programName,
        score: score,
        docs: docs,
        status: status ?? this.status,
        submittedAt: submittedAt,
        notes: notes ?? this.notes,
      );
}

extension AdmissionStatusX on AdmissionStatus {
  String get label => switch (this) {
        AdmissionStatus.submitted => 'Submitted',
        AdmissionStatus.reviewing => 'Reviewing',
        AdmissionStatus.accepted => 'Accepted',
        AdmissionStatus.rejected => 'Rejected',
      };
}
