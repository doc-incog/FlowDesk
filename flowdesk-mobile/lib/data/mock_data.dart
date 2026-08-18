import '../models/check_in.dart';
import '../models/mentor.dart';
import '../models/notification_item.dart';
import '../models/role.dart';
import '../models/schedule_slot.dart';
import '../models/user.dart';

const adminCreds = (email: 'admin@flowdesk.edu', password: 'flowdesk-admin@2026');

const demoUsers = <Role, UserProfile>{
  Role.student: UserProfile(
    id: 'STU-2043',
    name: 'Aisha Karim',
    role: Role.student,
    email: 'aisha.karim@campus.edu',
    avatarInitials: 'AK',
    department: 'Computer Science',
    batch: '2023–2027',
    semester: 'Semester 5',
    rollNo: 'CS23-2043',
    mentorId: 'MEN-01',
    phone: '+91 98765 12345',
    address: '204, Lakeview Residency, Pune',
    guardianName: 'Mrs. Farah Karim',
    guardianPhone: '+91 98765 11122',
    emergencyContact: '+91 98220 55511',
    dob: '2005-04-12',
  ),
  Role.staff: UserProfile(
    id: 'STF-118',
    name: 'Dr. Rahul Menon',
    role: Role.staff,
    email: 'rahul.menon@campus.edu',
    avatarInitials: 'RM',
    department: 'Computer Science',
    designation: 'Associate Professor',
    subjects: ['Data Structures', 'Operating Systems'],
    phone: '+91 98765 43210',
    address: 'Faculty Block, Room 214',
    dob: '1982-09-30',
  ),
  Role.admin: UserProfile(
    id: 'ADM-004',
    name: 'Priya Sharma',
    role: Role.admin,
    email: 'priya.sharma@campus.edu',
    avatarInitials: 'PS',
    department: 'Administration',
    designation: 'Campus Registrar',
    phone: '+91 98100 22334',
  ),
};

const checkIns = <CheckInRecord>[
  CheckInRecord(id: 'c1', name: 'Aisha Karim', role: Role.student, time: '08:42 AM', status: CheckInStatus.onTime, method: CheckInMethod.biometric),
  CheckInRecord(id: 'c2', name: 'Dev Patel', role: Role.student, time: '08:55 AM', status: CheckInStatus.onTime, method: CheckInMethod.webauthn),
  CheckInRecord(id: 'c3', name: 'Dr. Rahul Menon', role: Role.staff, time: '08:30 AM', status: CheckInStatus.onTime, method: CheckInMethod.biometric),
  CheckInRecord(id: 'c4', name: 'Sara Lin', role: Role.student, time: '09:18 AM', status: CheckInStatus.late, method: CheckInMethod.biometric),
  CheckInRecord(id: 'c5', name: 'Omar Faruk', role: Role.student, time: '—', status: CheckInStatus.absent, method: CheckInMethod.manual),
  CheckInRecord(id: 'c6', name: 'Dr. Neha Gupta', role: Role.staff, time: '08:48 AM', status: CheckInStatus.onTime, method: CheckInMethod.webauthn),
  CheckInRecord(id: 'c7', name: 'Liam Wong', role: Role.student, time: '09:05 AM', status: CheckInStatus.late, method: CheckInMethod.biometric),
];

const notifications = <NotificationItem>[
  NotificationItem(
    id: 'n1',
    title: 'Mid-term timetable released',
    body: 'The Semester 5 mid-term examination schedule is now available in the schedule section.',
    time: '12 min ago',
    category: NotificationCategory.academic,
    unread: true,
  ),
  NotificationItem(
    id: 'n2',
    title: 'Biometric device #3 back online',
    body: 'The fingerprint scanner at the Science Block entrance has been restored.',
    time: '1 hr ago',
    category: NotificationCategory.system,
    unread: true,
  ),
  NotificationItem(
    id: 'n3',
    title: 'Tech fest registrations open',
    body: 'Register for CampusHack 2026 before Friday to secure your team slot.',
    time: '3 hr ago',
    category: NotificationCategory.event,
    unread: false,
  ),
  NotificationItem(
    id: 'n4',
    title: 'Low attendance warning',
    body: '3 students in CS23 have dropped below the 75% attendance threshold.',
    time: 'Yesterday',
    category: NotificationCategory.alert,
    unread: false,
  ),
];

const schedule = <ScheduleSlot>[
  ScheduleSlot(id: 's1', day: 'Mon', start: '09:00', end: '10:30', module: 'Data Structures', code: 'CS301', room: 'B-204', staff: 'Dr. Rahul Menon'),
  ScheduleSlot(id: 's2', day: 'Mon', start: '11:00', end: '12:30', module: 'Database Systems', code: 'CS304', room: 'B-210', staff: 'Dr. Neha Gupta'),
  ScheduleSlot(id: 's3', day: 'Tue', start: '09:00', end: '10:30', module: 'Operating Systems', code: 'CS302', room: 'A-101', staff: 'Dr. Rahul Menon'),
  ScheduleSlot(id: 's4', day: 'Wed', start: '10:30', end: '12:00', module: 'Computer Networks', code: 'CS305', room: 'B-204', staff: 'Prof. Karan Rao'),
  ScheduleSlot(id: 's5', day: 'Thu', start: '09:00', end: '10:30', module: 'Software Engineering', code: 'CS306', room: 'C-115', staff: 'Dr. Neha Gupta'),
  ScheduleSlot(id: 's6', day: 'Fri', start: '11:00', end: '12:30', module: 'Theory of Computation', code: 'CS303', room: 'A-101', staff: 'Prof. Karan Rao'),
  ScheduleSlot(id: 's7', day: 'Sun', start: '10:00', end: '12:00', module: 'Python Workshop', code: 'CS310', room: 'C-101', staff: 'Dr. Neha Gupta'),
];

/// Days offered in the weekly routine. Sunday is a real, schedulable day.
const scheduleDays = <String>['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sun'];

/// Default section visibility per role key — mirrors the web app's
/// DEFAULT_ROLE_PERMISSIONS seed.
const defaultRolePermissions = <String, List<String>>{
  'student': [
    'overview', 'checkin', 'notifications', 'mentor', 'chat', 'schedule', 'exams',
    'assignments', 'fees', 'scholarships', 'helpdesk', 'feedback', 'profile',
  ],
  'staff': [
    'overview', 'checkin', 'notifications', 'students', 'mentor', 'chat', 'schedule',
    'exams', 'assignments', 'helpdesk', 'feedback', 'profile',
  ],
  'admin': [
    'overview', 'checkin', 'notifications', 'students', 'staff', 'chat',
    'schedule', 'exams', 'assignments', 'fees', 'scholarships', 'admissions',
    'helpdesk', 'feedback', 'profile', 'roles',
  ],
};

const mentors = <Mentor>[
  Mentor(
    id: 'MEN-01',
    name: 'Dr. Rahul Menon',
    designation: 'Associate Professor',
    department: 'Computer Science',
    email: 'rahul.menon@campus.edu',
    phone: '+91 98765 43210',
    office: 'Faculty Block, Room 214',
    officeHours: 'Mon & Wed, 2:00–4:00 PM',
    avatarInitials: 'RM',
    mentees: 12,
  ),
  Mentor(
    id: 'MEN-02',
    name: 'Dr. Neha Gupta',
    designation: 'Assistant Professor',
    department: 'Computer Science',
    email: 'neha.gupta@campus.edu',
    phone: '+91 98111 22334',
    office: 'Faculty Block, Room 209',
    officeHours: 'Tue & Thu, 11:00 AM–1:00 PM',
    avatarInitials: 'NG',
    mentees: 9,
  ),
];

const students = <UserProfile>[
  UserProfile(id: 'STU-2043', name: 'Aisha Karim', role: Role.student, email: 'aisha.karim@campus.edu', avatarInitials: 'AK', department: 'Computer Science', semester: 'Semester 5', rollNo: 'CS23-2043', mentorId: 'MEN-01'),
  UserProfile(id: 'STU-2044', name: 'Dev Patel', role: Role.student, email: 'dev.patel@campus.edu', avatarInitials: 'DP', department: 'Computer Science', semester: 'Semester 5', rollNo: 'CS23-2044', mentorId: 'MEN-01'),
  UserProfile(id: 'STU-2045', name: 'Sara Lin', role: Role.student, email: 'sara.lin@campus.edu', avatarInitials: 'SL', department: 'Computer Science', semester: 'Semester 5', rollNo: 'CS23-2045', mentorId: 'MEN-02'),
  UserProfile(id: 'STU-2046', name: 'Omar Faruk', role: Role.student, email: 'omar.faruk@campus.edu', avatarInitials: 'OF', department: 'Computer Science', semester: 'Semester 5', rollNo: 'CS23-2046', mentorId: 'MEN-02'),
  UserProfile(id: 'STU-2047', name: 'Liam Wong', role: Role.student, email: 'liam.wong@campus.edu', avatarInitials: 'LW', department: 'Computer Science', semester: 'Semester 5', rollNo: 'CS23-2047', mentorId: 'MEN-01'),
];

const staff = <UserProfile>[
  UserProfile(id: 'STF-118', name: 'Dr. Rahul Menon', role: Role.staff, email: 'rahul.menon@campus.edu', avatarInitials: 'RM', department: 'Computer Science', designation: 'Associate Professor', subjects: ['Data Structures', 'Operating Systems']),
  UserProfile(id: 'STF-119', name: 'Dr. Neha Gupta', role: Role.staff, email: 'neha.gupta@campus.edu', avatarInitials: 'NG', department: 'Computer Science', designation: 'Assistant Professor', subjects: ['Database Systems', 'Software Engineering']),
  UserProfile(id: 'STF-120', name: 'Prof. Karan Rao', role: Role.staff, email: 'karan.rao@campus.edu', avatarInitials: 'KR', department: 'Computer Science', designation: 'Professor', subjects: ['Computer Networks', 'Theory of Computation']),
];

class CampusStats {
  const CampusStats({
    required this.totalStudents,
    required this.totalStaff,
    required this.presentToday,
    required this.biometricDevices,
    required this.devicesOnline,
    required this.avgAttendance,
  });

  final int totalStudents;
  final int totalStaff;
  final int presentToday;
  final int biometricDevices;
  final int devicesOnline;
  final int avgAttendance;
}

const campusStats = CampusStats(
  totalStudents: 1284,
  totalStaff: 96,
  presentToday: 1147,
  biometricDevices: 8,
  devicesOnline: 7,
  avgAttendance: 89,
);
