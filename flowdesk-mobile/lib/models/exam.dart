enum ExamType { midterm, finalTerm, practical }

extension ExamTypeX on ExamType {
  String get label => switch (this) {
        ExamType.midterm => 'Midterm',
        ExamType.finalTerm => 'Final',
        ExamType.practical => 'Practical',
      };
}

class Exam {
  const Exam({
    required this.id,
    required this.title,
    required this.moduleCode,
    required this.moduleName,
    required this.type,
    required this.date,
    required this.start,
    required this.end,
    required this.room,
    required this.maxMarks,
  });

  final String id;
  final String title;
  final String moduleCode;
  final String moduleName;
  final ExamType type;
  final String date;
  final String start;
  final String end;
  final String room;
  final int maxMarks;

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'moduleCode': moduleCode,
        'moduleName': moduleName,
        'type': type.name,
        'date': date,
        'start': start,
        'end': end,
        'room': room,
        'maxMarks': maxMarks,
      };

  factory Exam.fromJson(Map<String, dynamic> json) => Exam(
        id: json['id'] as String,
        title: json['title'] as String,
        moduleCode: json['moduleCode'] as String,
        moduleName: json['moduleName'] as String,
        type: switch (json['type']) {
          'final' => ExamType.finalTerm,
          'practical' => ExamType.practical,
          _ => ExamType.midterm,
        },
        date: json['date'] as String,
        start: json['start'] as String,
        end: json['end'] as String,
        room: json['room'] as String,
        maxMarks: (json['maxMarks'] as num).toInt(),
      );
}

class ResultRow {
  const ResultRow({
    required this.id,
    required this.examId,
    required this.studentId,
    required this.marks,
    required this.maxMarks,
  });

  final String id;
  final String examId;
  final String studentId;
  final int marks;
  final int maxMarks;

  Map<String, dynamic> toJson() => {
        'id': id,
        'examId': examId,
        'studentId': studentId,
        'marks': marks,
        'maxMarks': maxMarks,
      };

  factory ResultRow.fromJson(Map<String, dynamic> json) => ResultRow(
        id: json['id'] as String,
        examId: json['examId'] as String,
        studentId: json['studentId'] as String,
        marks: (json['marks'] as num).toInt(),
        maxMarks: (json['maxMarks'] as num).toInt(),
      );

  ResultRow copyWith({int? marks}) => ResultRow(
        id: id,
        examId: examId,
        studentId: studentId,
        marks: marks ?? this.marks,
        maxMarks: maxMarks,
      );
}
