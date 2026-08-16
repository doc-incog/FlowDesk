import '../models/admission.dart';

const programs = <Program>[
  Program(id: 'PG-01', name: 'B.Tech Computer Science', duration: '4 Years', seats: 120, deadline: '30 Aug 2026', fee: 85000),
  Program(id: 'PG-02', name: 'B.Tech Electronics', duration: '4 Years', seats: 90, deadline: '30 Aug 2026', fee: 78000),
  Program(id: 'PG-03', name: 'B.Sc Computer Science', duration: '3 Years', seats: 80, deadline: '15 Sep 2026', fee: 42000),
  Program(id: 'PG-04', name: 'M.Tech Computer Science', duration: '2 Years', seats: 40, deadline: '30 Sep 2026', fee: 110000),
  Program(id: 'PG-05', name: 'MBA', duration: '2 Years', seats: 60, deadline: '30 Sep 2026', fee: 145000),
];

const seedAdmissionApplications = <AdmissionApplication>[
  AdmissionApplication(id: 'AA-1042', applicantName: 'Maya Krishnan', email: 'maya.k@mail.com', programId: 'PG-01', programName: 'B.Tech Computer Science', score: 91, docs: ['marksheet.pdf', 'id_proof.pdf'], status: AdmissionStatus.reviewing, submittedAt: '11 Aug 2026', notes: 'Documents verified, waiting for interview slot.'),
  AdmissionApplication(id: 'AA-1043', applicantName: 'Rohan Mehta', email: 'rohan.m@mail.com', programId: 'PG-03', programName: 'B.Sc Computer Science', score: 84, docs: ['marksheet.pdf'], status: AdmissionStatus.submitted, submittedAt: '12 Aug 2026'),
  AdmissionApplication(id: 'AA-1044', applicantName: 'Zara Khan', email: 'zara.k@mail.com', programId: 'PG-05', programName: 'MBA', score: 88, docs: ['marksheet.pdf', 'recommendation.pdf'], status: AdmissionStatus.accepted, submittedAt: '09 Aug 2026', notes: 'Offer letter ready.'),
  AdmissionApplication(id: 'AA-1045', applicantName: 'Ishaan Roy', email: 'ishaan.r@mail.com', programId: 'PG-04', programName: 'M.Tech Computer Science', score: 76, docs: ['marksheet.pdf'], status: AdmissionStatus.rejected, submittedAt: '07 Aug 2026', notes: 'Below cutoff for the current intake.'),
];
