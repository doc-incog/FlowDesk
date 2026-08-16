import '../models/feedback.dart';

const feedbackTargets = <FeedbackTarget>[
  FeedbackTarget(id: 'fb1', type: FeedbackTargetType.teacher, name: 'Dr. Rahul Menon', subtitle: 'Data Structures · CS301'),
  FeedbackTarget(id: 'fb2', type: FeedbackTargetType.teacher, name: 'Dr. Neha Gupta', subtitle: 'Database Systems · CS304'),
  FeedbackTarget(id: 'fb3', type: FeedbackTargetType.teacher, name: 'Prof. Karan Rao', subtitle: 'Computer Networks · CS305'),
  FeedbackTarget(id: 'fb4', type: FeedbackTargetType.teacher, name: 'Prof. Anjali Nair', subtitle: 'Software Engineering · CS306'),
  FeedbackTarget(id: 'fb5', type: FeedbackTargetType.event, name: 'CampusHack 2026', subtitle: '24-hour hackathon'),
  FeedbackTarget(id: 'fb6', type: FeedbackTargetType.event, name: 'Annual Sports Meet', subtitle: 'Inter-college tournament'),
];

const seedFeedbackEntries = <FeedbackEntry>[
  FeedbackEntry(id: 'fe1', targetId: 'fb1', rating: 5, comment: 'Explains concepts brilliantly with real examples.', byName: 'Aisha Karim', createdAt: '14 Aug 2026'),
  FeedbackEntry(id: 'fe2', targetId: 'fb1', rating: 4, comment: 'Great pace, slightly fast in the last unit.', byName: 'Dev Patel', createdAt: '13 Aug 2026'),
  FeedbackEntry(id: 'fe3', targetId: 'fb2', rating: 4, comment: 'Very structured lectures, helpful slides.', byName: 'Sara Lin', createdAt: '12 Aug 2026'),
  FeedbackEntry(id: 'fe4', targetId: 'fb2', rating: 5, comment: 'Loved the lab exercises.', byName: 'Omar Faruk', createdAt: '11 Aug 2026'),
  FeedbackEntry(id: 'fe5', targetId: 'fb3', rating: 3, comment: 'Good content but the assignments were heavy.', byName: 'Liam Wong', createdAt: '10 Aug 2026'),
  FeedbackEntry(id: 'fe6', targetId: 'fb4', rating: 4, comment: 'Clear communication, approachable.', byName: 'Aisha Karim', createdAt: '09 Aug 2026'),
  FeedbackEntry(id: 'fe7', targetId: 'fb5', rating: 5, comment: 'Best event of the semester, well organised!', byName: 'Dev Patel', createdAt: '08 Aug 2026'),
  FeedbackEntry(id: 'fe8', targetId: 'fb6', rating: 4, comment: 'Great energy, would love more categories.', byName: 'Sara Lin', createdAt: '07 Aug 2026'),
];
