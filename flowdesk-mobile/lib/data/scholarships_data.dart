import '../models/scholarship.dart';

const scholarships = <Scholarship>[
  Scholarship(id: 'sch1', name: 'Merit Scholarship', provider: 'University Trust', amount: 50000, eligibility: 'CGPA above 8.5 and family income below ₹8 lakh/year', seats: 25, deadline: '30 Sep 2026', description: 'Awarded to top-performing students across all departments based on academic excellence.'),
  Scholarship(id: 'sch2', name: 'Need-based Scholarship', provider: 'State Government', amount: 30000, eligibility: 'Family income below ₹6 lakh/year', seats: 100, deadline: '15 Oct 2026', description: 'Financial assistance for students from economically weaker backgrounds.'),
  Scholarship(id: 'sch3', name: 'Sports Excellence Award', provider: 'Sports Council', amount: 25000, eligibility: 'State or national level participation in recognised sports', seats: 15, deadline: '20 Oct 2026', description: 'Support for student athletes representing the university in competitions.'),
  Scholarship(id: 'sch4', name: 'Women in STEM', provider: 'Tech Foundation', amount: 35000, eligibility: 'Female students enrolled in engineering or science programmes', seats: 40, deadline: '10 Nov 2026', description: 'Encouraging women to pursue careers in science, technology, engineering and mathematics.'),
];

const seedScholarshipApplications = <ScholarshipApplication>[
  ScholarshipApplication(id: 'sa1', scholarshipId: 'sch1', studentId: 'STU-2043', studentName: 'Aisha Karim', status: ScholarshipStatus.underReview, submittedAt: '12 Aug 2026', docs: ['marksheet.pdf', 'income_certificate.pdf']),
  ScholarshipApplication(id: 'sa2', scholarshipId: 'sch2', studentId: 'STU-2046', studentName: 'Omar Faruk', status: ScholarshipStatus.submitted, submittedAt: '14 Aug 2026', docs: ['income_certificate.pdf']),
  ScholarshipApplication(id: 'sa3', scholarshipId: 'sch4', studentId: 'STU-2045', studentName: 'Sara Lin', status: ScholarshipStatus.approved, submittedAt: '10 Aug 2026', docs: ['marksheet.pdf', 'statement.pdf']),
];
