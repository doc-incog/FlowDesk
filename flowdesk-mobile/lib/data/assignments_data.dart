import '../models/assignment.dart';

const assignments = <Assignment>[
  Assignment(id: 'a1', moduleCode: 'CS301', moduleName: 'Data Structures', title: 'Balanced BST Implementation', description: 'Implement AVL tree with insert, delete and rotations. Compare with plain BST on random datasets.', assignedDate: '02 Aug 2026', dueDate: '2026-08-20', maxMarks: 20),
  Assignment(id: 'a2', moduleCode: 'CS304', moduleName: 'Database Systems', title: 'ER Diagram and Normalisation', description: 'Design an ER diagram for a library management system and normalise it to 3NF.', assignedDate: '04 Aug 2026', dueDate: '2026-08-25', maxMarks: 15),
  Assignment(id: 'a3', moduleCode: 'CS302', moduleName: 'Operating Systems', title: 'Scheduling Algorithms Report', description: 'Simulate FCFS, SJF and Round Robin on the given workload and compare turnaround times.', assignedDate: '06 Aug 2026', dueDate: '2026-08-18', maxMarks: 25),
  Assignment(id: 'a4', moduleCode: 'CS305', moduleName: 'Computer Networks', title: 'TCP vs UDP Lab Sheet', description: 'Write a socket program demonstrating TCP and UDP behaviour with packet loss simulation.', assignedDate: '08 Aug 2026', dueDate: '2026-08-30', maxMarks: 20),
];

const seedSubmissions = <Submission>[
  Submission(id: 'sb1', assignmentId: 'a1', studentId: 'STU-2043', studentName: 'Aisha Karim', submittedAt: '18 Aug 2026', fileName: 'avl_tree.py', marks: 18, feedback: 'Solid rotations, add more test cases for edge cases.'),
  Submission(id: 'sb2', assignmentId: 'a1', studentId: 'STU-2044', studentName: 'Dev Patel', submittedAt: '19 Aug 2026', fileName: 'avl.dart', marks: 15, feedback: 'Clean code, deletion case needs work.'),
  Submission(id: 'sb3', assignmentId: 'a2', studentId: 'STU-2043', studentName: 'Aisha Karim', submittedAt: '21 Aug 2026', fileName: 'erd.pdf', marks: 14, feedback: 'Well structured, minor redundancy in entity attributes.'),
  Submission(id: 'sb4', assignmentId: 'a3', studentId: 'STU-2045', studentName: 'Sara Lin', submittedAt: '17 Aug 2026', fileName: 'scheduling.py', marks: null, feedback: ''),
];
