export type Scholarship = {
  id: string
  name: string
  provider: string
  amount: number
  eligibility: string
  seats: number
  deadline: string
  description: string
}

export type ScholarshipStatus = "submitted" | "under-review" | "approved" | "rejected"

export type ScholarshipApplication = {
  id: string
  scholarshipId: string
  studentId: string
  studentName: string
  status: ScholarshipStatus
  submittedAt: string
  docs: string[]
}

export const SCHOLARSHIPS: Scholarship[] = [
  {
    id: "S1",
    name: "National Merit Scholarship",
    provider: "Central Scholarship Board",
    amount: 50000,
    eligibility: "CGPA ≥ 9.0",
    seats: 40,
    deadline: "30 Sep 2026",
    description: "Rewards top academic performers across all programmes.",
  },
  {
    id: "S2",
    name: "Need-based Financial Aid",
    provider: "Campus Alumni Fund",
    amount: 30000,
    eligibility: "Family income below ₹6 LPA",
    seats: 120,
    deadline: "15 Oct 2026",
    description: "Income-assessed support to cover tuition and hostel costs.",
  },
  {
    id: "S3",
    name: "Sports Excellence Grant",
    provider: "Ministry of Sports",
    amount: 25000,
    eligibility: "State / national level sportspersons",
    seats: 30,
    deadline: "20 Oct 2026",
    description: "For students representing the campus in recognised competitions.",
  },
  {
    id: "S4",
    name: "Women in STEM Scholarship",
    provider: "TechForward Foundation",
    amount: 35000,
    eligibility: "Female students in engineering / CS",
    seats: 50,
    deadline: "05 Nov 2026",
    description: "Encourages women pursuing technology and engineering degrees.",
  },
]

export const SCHOLARSHIP_APPLICATIONS: ScholarshipApplication[] = [
  { id: "SA-101", scholarshipId: "S1", studentId: "STU-2043", studentName: "Aisha Karim", status: "under-review", submittedAt: "12 Aug 2026", docs: ["Academic transcript", "ID proof"] },
  { id: "SA-102", scholarshipId: "S3", studentId: "STU-2047", studentName: "Liam Wong", status: "approved", submittedAt: "08 Aug 2026", docs: ["Sports certificate", "ID proof"] },
  { id: "SA-103", scholarshipId: "S2", studentId: "STU-2046", studentName: "Omar Faruk", status: "submitted", submittedAt: "14 Aug 2026", docs: ["Income certificate", "Academic transcript"] },
]
