class Assignment {
  const Assignment({
    required this.id,
    required this.moduleCode,
    required this.moduleName,
    required this.title,
    required this.description,
    required this.assignedDate,
    required this.dueDate,
    required this.maxMarks,
  });

  final String id;
  final String moduleCode;
  final String moduleName;
  final String title;
  final String description;
  final String assignedDate;
  final String dueDate; // ISO yyyy-mm-dd
  final int maxMarks;

  Map<String, dynamic> toJson() => {
        'id': id,
        'moduleCode': moduleCode,
        'moduleName': moduleName,
        'title': title,
        'description': description,
        'assignedDate': assignedDate,
        'dueDate': dueDate,
        'maxMarks': maxMarks,
      };

  factory Assignment.fromJson(Map<String, dynamic> json) => Assignment(
        id: json['id'] as String,
        moduleCode: json['moduleCode'] as String,
        moduleName: json['moduleName'] as String,
        title: json['title'] as String,
        description: json['description'] as String,
        assignedDate: json['assignedDate'] as String,
        dueDate: json['dueDate'] as String,
        maxMarks: (json['maxMarks'] as num).toInt(),
      );
}

enum AssignmentStatus { overdue, pending, submitted, graded }

class Submission {
  const Submission({
    required this.id,
    required this.assignmentId,
    required this.studentId,
    required this.studentName,
    required this.submittedAt,
    required this.fileName,
    this.marks,
    this.feedback = '',
  });

  final String id;
  final String assignmentId;
  final String studentId;
  final String studentName;
  final String submittedAt;
  final String fileName;
  final int? marks;
  final String feedback;

  Map<String, dynamic> toJson() => {
        'id': id,
        'assignmentId': assignmentId,
        'studentId': studentId,
        'studentName': studentName,
        'submittedAt': submittedAt,
        'fileName': fileName,
        'marks': marks,
        'feedback': feedback,
      };

  factory Submission.fromJson(Map<String, dynamic> json) => Submission(
        id: json['id'] as String,
        assignmentId: json['assignmentId'] as String,
        studentId: json['studentId'] as String,
        studentName: json['studentName'] as String,
        submittedAt: json['submittedAt'] as String,
        fileName: json['fileName'] as String,
        marks: json['marks'] as int?,
        feedback: json['feedback'] as String? ?? '',
      );

  Submission copyWith({int? marks, String? feedback}) => Submission(
        id: id,
        assignmentId: assignmentId,
        studentId: studentId,
        studentName: studentName,
        submittedAt: submittedAt,
        fileName: fileName,
        marks: marks ?? this.marks,
        feedback: feedback ?? this.feedback,
      );
}
