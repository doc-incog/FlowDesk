class Scholarship {
  const Scholarship({
    required this.id,
    required this.name,
    required this.provider,
    required this.amount,
    required this.eligibility,
    required this.seats,
    required this.deadline,
    required this.description,
  });

  final String id;
  final String name;
  final String provider;
  final int amount;
  final String eligibility;
  final int seats;
  final String deadline;
  final String description;
}

enum ScholarshipStatus { submitted, underReview, approved, rejected }

class ScholarshipApplication {
  const ScholarshipApplication({
    required this.id,
    required this.scholarshipId,
    required this.studentId,
    required this.studentName,
    required this.status,
    required this.submittedAt,
    required this.docs,
  });

  final String id;
  final String scholarshipId;
  final String studentId;
  final String studentName;
  final ScholarshipStatus status;
  final String submittedAt;
  final List<String> docs;

  Map<String, dynamic> toJson() => {
        'id': id,
        'scholarshipId': scholarshipId,
        'studentId': studentId,
        'studentName': studentName,
        'status': status.name,
        'submittedAt': submittedAt,
        'docs': docs,
      };

  factory ScholarshipApplication.fromJson(Map<String, dynamic> json) =>
      ScholarshipApplication(
        id: json['id'] as String,
        scholarshipId: json['scholarshipId'] as String,
        studentId: json['studentId'] as String,
        studentName: json['studentName'] as String,
        status: ScholarshipStatus.values.firstWhere(
            (s) => s.name == json['status'],
            orElse: () => ScholarshipStatus.submitted),
        submittedAt: json['submittedAt'] as String,
        docs: (json['docs'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
      );

  ScholarshipApplication copyWith({ScholarshipStatus? status}) =>
      ScholarshipApplication(
        id: id,
        scholarshipId: scholarshipId,
        studentId: studentId,
        studentName: studentName,
        status: status ?? this.status,
        submittedAt: submittedAt,
        docs: docs,
      );
}

extension ScholarshipStatusX on ScholarshipStatus {
  String get label => switch (this) {
        ScholarshipStatus.submitted => 'Submitted',
        ScholarshipStatus.underReview => 'Under review',
        ScholarshipStatus.approved => 'Approved',
        ScholarshipStatus.rejected => 'Rejected',
      };
}
