export type FeedbackTarget = {
  id: string
  type: "teacher" | "event"
  name: string
  subtitle: string
}

export type FeedbackEntry = {
  id: string
  targetId: string
  rating: number
  comment: string
  byName: string
  createdAt: string
}

export const FEEDBACK_TARGETS: FeedbackTarget[] = [
  { id: "T1", type: "teacher", name: "Dr. Rahul Menon", subtitle: "Data Structures" },
  { id: "T2", type: "teacher", name: "Dr. Neha Gupta", subtitle: "Database Systems" },
  { id: "T3", type: "teacher", name: "Prof. Karan Rao", subtitle: "Computer Networks" },
  { id: "T4", type: "teacher", name: "Dr. Sanjay Iyer", subtitle: "Discrete Mathematics" },
  { id: "T5", type: "event", name: "CampusHack 2026", subtitle: "Annual hackathon" },
  { id: "T6", type: "event", name: "Freshers' Week", subtitle: "Orientation & socials" },
]

export const FEEDBACK_ENTRIES: FeedbackEntry[] = [
  { id: "F1", targetId: "T1", rating: 5, comment: "Explains complex topics with great clarity.", byName: "Dev Patel", createdAt: "10 Aug 2026" },
  { id: "F2", targetId: "T1", rating: 4, comment: "Great classes, wish the labs were longer.", byName: "Sara Lin", createdAt: "09 Aug 2026" },
  { id: "F3", targetId: "T2", rating: 5, comment: "Very structured and always approachable.", byName: "Aisha Karim", createdAt: "11 Aug 2026" },
  { id: "F4", targetId: "T2", rating: 3, comment: "Good content, pace a bit fast.", byName: "Omar Faruk", createdAt: "08 Aug 2026" },
  { id: "F5", targetId: "T3", rating: 4, comment: "Puts concepts in real-world context.", byName: "Liam Wong", createdAt: "12 Aug 2026" },
  { id: "F6", targetId: "T5", rating: 5, comment: "Best event of the year, amazing energy.", byName: "Sara Lin", createdAt: "14 Aug 2026" },
  { id: "F7", targetId: "T5", rating: 4, comment: "Great organization, more food stalls please.", byName: "Dev Patel", createdAt: "14 Aug 2026" },
  { id: "F8", targetId: "T6", rating: 3, comment: "Fun, but a lot of waiting at registration.", byName: "Omar Faruk", createdAt: "01 Aug 2026" },
]

export function averageRating(entries: FeedbackEntry[]): number {
  if (entries.length === 0) return 0
  return Math.round((entries.reduce((s, e) => s + e.rating, 0) / entries.length) * 10) / 10
}
