import '../models/chat.dart';

const chatFaq = <ChatFaq>[
  ChatFaq(keywords: ['fee', 'pay', 'payment', 'receipt', 'tuition'], answer: 'You can pay your semester fees under Online Fees in the dashboard. UPI, Card and Net Banking are supported, and receipts are generated instantly.'),
  ChatFaq(keywords: ['exam', 'schedule', 'midterm', 'final', 'result', 'marks'], answer: 'Exam timetables and results are available under Exams & Results. Your seating is allocated automatically for each exam.'),
  ChatFaq(keywords: ['admission', 'apply', 'application', 'enrolment'], answer: 'Admissions are open! Visit the Apply page or check the Admissions section to see programmes, seats and deadlines.'),
  ChatFaq(keywords: ['scholarship', 'scholarships', 'financial aid', 'award'], answer: 'Scholarships are listed in the Scholarships section with eligibility, amount and deadline. Apply with your latest marksheet.'),
  ChatFaq(keywords: ['attendance', 'biometric', 'check in', 'check-in', 'fingerprint'], answer: 'Check in using the biometric scanner near any entrance, or use the Check-in section to record your presence for the day.'),
  ChatFaq(keywords: ['library', 'book', 'issue'], answer: 'The library is open 8:00 AM to 8:00 PM on weekdays. Books can be issued for 14 days; renewals are done at the circulation desk.'),
  ChatFaq(keywords: ['hostel', 'accommodation', 'room', 'mess'], answer: 'Hostel queries can be raised via the Helpdesk. Room allocation and mess menu are managed by the hostel office.'),
  ChatFaq(keywords: ['timing', 'hours', 'office', 'open'], answer: 'Administrative offices are open 9:00 AM to 5:00 PM, Monday to Friday. The helpdesk is available on all working days.'),
  ChatFaq(keywords: ['transport', 'bus', 'shuttle', 'route'], answer: 'Transport schedules and route details are available from the transport office. Report delays via the Helpdesk.'),
  ChatFaq(keywords: ['help', 'complaint', 'issue', 'problem', 'helpdesk'], answer: 'Raise a complaint from the Helpdesk section. Choose a category, add details, and track the status in your tickets.'),
  ChatFaq(keywords: ['assignment', 'homework', 'submission', 'deadline'], answer: 'Assignments are listed with due dates and status under Assignments. Submit files from the assignment detail view.'),
  ChatFaq(keywords: ['feedback', 'review', 'rate'], answer: 'Share feedback on your teachers and campus events from the Feedback section. Your ratings help improve the experience.'),
  ChatFaq(keywords: ['contact', 'reach', 'office', 'mentor', 'faculty'], answer: 'You can reach faculty and mentors from the directory or your Mentor section. Office hours are listed on each profile.'),
  ChatFaq(keywords: ['schedule', 'routine', 'timetable', 'classes'], answer: 'Your weekly routine is available under Schedule. It updates in real time and shows room and faculty for each class.'),
];

const chatSuggestions = <String>[
  'Fee payment',
  'Exam schedule',
  'Admissions',
  'Scholarships',
  'Library timings',
  'Raise a complaint',
];

const chatFallback =
    'I can help with fees, exams, admissions, scholarships, schedules, helpdesk and more. Try asking about one of those!';
