export type ChatFaq = {
  keywords: string[]
  answer: string
}

export const CHAT_FAQ: ChatFaq[] = [
  {
    keywords: ["fee", "pay", "payment", "receipt", "tuition"],
    answer:
      "Semester fees can be paid online from the Fees section (UPI, card, net banking). A digital receipt is generated instantly and can be downloaded from the same section. Tuition for this semester is ₹85,000 and is due 10 Aug 2026.",
  },
  {
    keywords: ["exam", "result", "mark", "grade", "report card", "seat"],
    answer:
      "Mid-term exams run 10–14 Mar 2026 and finals end in early June. You can view your exam schedule, seating plan and digital report card in the Exams & Results section. Grades are auto-calculated from entered marks.",
  },
  {
    keywords: ["admission", "apply", "enrol", "enrollment", "enrolment", "application"],
    answer:
      "Admissions for the 2026 intake are open. Fill the online application on the Apply page, attach your documents, and track your status there. Applications move from Submitted → Reviewing → Accepted/Rejected.",
  },
  {
    keywords: ["scholarship", "waiver", "concession", "aid", "grant"],
    answer:
      "We offer merit, need-based, sports and Women-in-STEM scholarships. Check eligibility and apply from the Scholarships section. Applications are reviewed and status updates appear within 2 weeks.",
  },
  {
    keywords: ["attendance", "check", "checkin", "biometric", "present"],
    answer:
      "Attendance is recorded via biometric check-in at the scanners. Use the Check-in section to mark attendance with your device fingerprint (WebAuthn). Your attendance percentage is shown on the Overview dashboard.",
  },
  {
    keywords: ["library", "book", "lending", "issue"],
    answer:
      "The library is open Mon–Sat, 8:00 AM – 9:00 PM (closed Sundays). Reserved textbooks for CS modules are issued at the counter. Report shelving issues through the Helpdesk.",
  },
  {
    keywords: ["hostel", "room", "dorm", "accommodation", "mess"],
    answer:
      "Hostel accommodation is available in Blocks A–C. For hot water, maintenance or room issues, raise a complaint in the Helpdesk — the Hostel Office typically responds within 24 hours.",
  },
  {
    keywords: ["timing", "office hour", "open", "close", "time"],
    answer:
      "Campus offices are open 9:00 AM – 5:00 PM, Monday to Friday. The administration block handles registrations and certificates at the ground floor reception.",
  },
  {
    keywords: ["transport", "bus", "shuttle", "conveyance"],
    answer:
      "College buses cover most city routes with morning and evening trips. The transport office is in the ground floor of the admin block; report bus issues via the Helpdesk.",
  },
  {
    keywords: ["helpdesk", "complaint", "issue", "problem", "report"],
    answer:
      "Raise any complaint (hostel, library, IT, transport, academics) from the Helpdesk section. You can track status and chat with the concerned faculty on the same ticket.",
  },
  {
    keywords: ["assignment", "homework", "submission", "task", "due"],
    answer:
      "Your assignments and their due dates are listed in the Assignments section. Submit your file there before the deadline — overdue submissions are marked automatically.",
  },
  {
    keywords: ["feedback", "review", "rate", "rating"],
    answer:
      "You can rate your teachers and campus events in the Feedback section. Ratings are anonymous and help improve teaching and event quality.",
  },
  {
    keywords: ["contact", "email", "phone", "reach", "help"],
    answer:
      "For general queries, email office@campus.edu or call the administration at +91 98765 00001 (9 AM – 5 PM, Mon–Fri). The main gate security desk can also route you to the right office.",
  },
  {
    keywords: ["schedule", "timetable", "routine", "class", "slot"],
    answer:
      "Your weekly module routine is in the Schedule section. It shows all classes for each day with rooms and faculty, plus conflict detection for staff and admins.",
  },
]

export const CHAT_SUGGESTIONS = [
  "Fee payment",
  "Exam schedule",
  "Admissions",
  "Scholarships",
  "Library timings",
  "Raise a complaint",
]

export const CHAT_FALLBACK =
  "I can help with fees, exams, admissions, scholarships, attendance, library, hostel, transport and helpdesk. Try asking me one of those, or tap a suggestion below."
