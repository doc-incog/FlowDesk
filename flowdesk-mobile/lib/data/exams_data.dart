import '../models/exam.dart';

const examinations = <Exam>[
  Exam(id: 'E1', title: 'Mid-term Examination', moduleCode: 'CS301', moduleName: 'Data Structures', type: ExamType.midterm, date: '10 Mar 2026', start: '09:00', end: '11:00', room: 'B-204', maxMarks: 50),
  Exam(id: 'E2', title: 'Mid-term Examination', moduleCode: 'CS304', moduleName: 'Database Systems', type: ExamType.midterm, date: '12 Mar 2026', start: '11:00', end: '13:00', room: 'B-210', maxMarks: 50),
  Exam(id: 'E3', title: 'Mid-term Examination', moduleCode: 'CS302', moduleName: 'Operating Systems', type: ExamType.midterm, date: '14 Mar 2026', start: '09:00', end: '11:00', room: 'A-101', maxMarks: 50),
  Exam(id: 'E4', title: 'Final Examination', moduleCode: 'CS301', moduleName: 'Data Structures', type: ExamType.finalTerm, date: '28 May 2026', start: '09:00', end: '12:00', room: 'B-204', maxMarks: 100),
  Exam(id: 'E5', title: 'Practical Examination', moduleCode: 'CS305', moduleName: 'Computer Networks', type: ExamType.practical, date: '05 Jun 2026', start: '14:00', end: '16:00', room: 'Lab-2', maxMarks: 30),
];

const seedResults = <ResultRow>[
  ResultRow(id: 'E1-STU-2043', examId: 'E1', studentId: 'STU-2043', marks: 42, maxMarks: 50),
  ResultRow(id: 'E1-STU-2044', examId: 'E1', studentId: 'STU-2044', marks: 38, maxMarks: 50),
  ResultRow(id: 'E1-STU-2045', examId: 'E1', studentId: 'STU-2045', marks: 35, maxMarks: 50),
  ResultRow(id: 'E1-STU-2046', examId: 'E1', studentId: 'STU-2046', marks: 28, maxMarks: 50),
  ResultRow(id: 'E1-STU-2047', examId: 'E1', studentId: 'STU-2047', marks: 44, maxMarks: 50),
  ResultRow(id: 'E2-STU-2043', examId: 'E2', studentId: 'STU-2043', marks: 40, maxMarks: 50),
  ResultRow(id: 'E2-STU-2044', examId: 'E2', studentId: 'STU-2044', marks: 33, maxMarks: 50),
  ResultRow(id: 'E2-STU-2045', examId: 'E2', studentId: 'STU-2045', marks: 29, maxMarks: 50),
  ResultRow(id: 'E2-STU-2046', examId: 'E2', studentId: 'STU-2046', marks: 22, maxMarks: 50),
  ResultRow(id: 'E2-STU-2047', examId: 'E2', studentId: 'STU-2047', marks: 41, maxMarks: 50),
  ResultRow(id: 'E3-STU-2043', examId: 'E3', studentId: 'STU-2043', marks: 45, maxMarks: 50),
  ResultRow(id: 'E3-STU-2044', examId: 'E3', studentId: 'STU-2044', marks: 36, maxMarks: 50),
  ResultRow(id: 'E3-STU-2045', examId: 'E3', studentId: 'STU-2045', marks: 31, maxMarks: 50),
  ResultRow(id: 'E3-STU-2046', examId: 'E3', studentId: 'STU-2046', marks: 30, maxMarks: 50),
  ResultRow(id: 'E3-STU-2047', examId: 'E3', studentId: 'STU-2047', marks: 39, maxMarks: 50),
  ResultRow(id: 'E4-STU-2043', examId: 'E4', studentId: 'STU-2043', marks: 88, maxMarks: 100),
  ResultRow(id: 'E4-STU-2044', examId: 'E4', studentId: 'STU-2044', marks: 74, maxMarks: 100),
  ResultRow(id: 'E4-STU-2045', examId: 'E4', studentId: 'STU-2045', marks: 69, maxMarks: 100),
  ResultRow(id: 'E4-STU-2046', examId: 'E4', studentId: 'STU-2046', marks: 55, maxMarks: 100),
  ResultRow(id: 'E4-STU-2047', examId: 'E4', studentId: 'STU-2047', marks: 82, maxMarks: 100),
  ResultRow(id: 'E5-STU-2043', examId: 'E5', studentId: 'STU-2043', marks: 26, maxMarks: 30),
  ResultRow(id: 'E5-STU-2044', examId: 'E5', studentId: 'STU-2044', marks: 22, maxMarks: 30),
  ResultRow(id: 'E5-STU-2045', examId: 'E5', studentId: 'STU-2045', marks: 24, maxMarks: 30),
  ResultRow(id: 'E5-STU-2046', examId: 'E5', studentId: 'STU-2046', marks: 20, maxMarks: 30),
  ResultRow(id: 'E5-STU-2047', examId: 'E5', studentId: 'STU-2047', marks: 27, maxMarks: 30),
];
