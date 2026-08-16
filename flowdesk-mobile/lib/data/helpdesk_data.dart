import '../models/complaint.dart';
import '../models/role.dart';

const complaintCategories = <ComplaintCategory>[
  ComplaintCategory.academics,
  ComplaintCategory.hostel,
  ComplaintCategory.library,
  ComplaintCategory.it,
  ComplaintCategory.transport,
  ComplaintCategory.other,
];

const seedComplaints = <Complaint>[
  Complaint(
    id: 'CMP-101',
    category: ComplaintCategory.hostel,
    subject: 'Broken water heater in Block C',
    description: 'The geyser on the third floor of Block C has not been working since Monday. Cold showers only.',
    status: ComplaintStatus.open,
    createdAt: '15 Aug 2026',
    raisedByName: 'Aisha Karim',
    raisedByRole: Role.student,
    comments: [
      ComplaintComment(id: 'cc1', author: 'Facilities Desk', text: 'We have raised a work order. Estimated repair within 48 hours.', at: '15 Aug 2026'),
    ],
  ),
  Complaint(
    id: 'CMP-102',
    category: ComplaintCategory.it,
    subject: 'Slow Wi-Fi in the library',
    description: 'Internet speeds in the library reading hall have dropped significantly this week.',
    status: ComplaintStatus.inProgress,
    createdAt: '13 Aug 2026',
    raisedByName: 'Dev Patel',
    raisedByRole: Role.student,
    comments: [
      ComplaintComment(id: 'cc2', author: 'IT Helpdesk', text: 'We are upgrading the access points. Should be resolved by Friday.', at: '14 Aug 2026'),
    ],
  ),
  Complaint(
    id: 'CMP-103',
    category: ComplaintCategory.library,
    subject: 'Need more copies of Data Structures text',
    description: 'The prescribed textbook has only 4 copies for 120 students in CS301.',
    status: ComplaintStatus.resolved,
    createdAt: '10 Aug 2026',
    raisedByName: 'Dr. Neha Gupta',
    raisedByRole: Role.staff,
    comments: [
      ComplaintComment(id: 'cc3', author: 'Library', text: '8 additional copies ordered and added to the reserve section.', at: '12 Aug 2026'),
    ],
  ),
  Complaint(
    id: 'CMP-104',
    category: ComplaintCategory.transport,
    subject: 'Bus 7 late every morning',
    description: 'Route 7 shuttle has been 15–20 minutes late every day this week.',
    status: ComplaintStatus.open,
    createdAt: '16 Aug 2026',
    raisedByName: 'Omar Faruk',
    raisedByRole: Role.student,
    comments: [],
  ),
];
