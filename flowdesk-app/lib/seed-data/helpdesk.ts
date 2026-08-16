import type { Role } from "./core"

export type ComplaintCategory = "Academics" | "Hostel" | "Library" | "IT" | "Transport" | "Other"
export type ComplaintStatus = "open" | "in-progress" | "resolved"

export type ComplaintComment = {
  id: string
  author: string
  text: string
  at: string
}

export type Complaint = {
  id: string
  category: ComplaintCategory
  subject: string
  description: string
  status: ComplaintStatus
  createdAt: string
  raisedByName: string
  raisedByRole: Role
  comments: ComplaintComment[]
}

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = ["Academics", "Hostel", "Library", "IT", "Transport", "Other"]

export const COMPLAINTS: Complaint[] = [
  {
    id: "CMP-501",
    category: "Hostel",
    subject: "Hot water not available in Block C",
    description: "No hot water in the morning since three days in hostel Block C, floors 4-6.",
    status: "in-progress",
    createdAt: "12 Aug 2026",
    raisedByName: "Dev Patel",
    raisedByRole: "student",
    comments: [
      { id: "cc1", author: "Hostel Office", text: "Maintenance team dispatched, boiler serviced today.", at: "13 Aug 2026" },
    ],
  },
  {
    id: "CMP-502",
    category: "IT",
    subject: "Lab-2 systems slow during practicals",
    description: "Systems in Lab-2 freeze during network practicals; needs OS reimage.",
    status: "open",
    createdAt: "14 Aug 2026",
    raisedByName: "Aisha Karim",
    raisedByRole: "student",
    comments: [],
  },
  {
    id: "CMP-503",
    category: "Library",
    subject: "Reserved books not shelved correctly",
    description: "Textbooks for CS301 are often missing from the reserved section.",
    status: "resolved",
    createdAt: "05 Aug 2026",
    raisedByName: "Sara Lin",
    raisedByRole: "student",
    comments: [
      { id: "cc2", author: "Library Staff", text: "Reserved section reorganized; holds now issued at the counter.", at: "07 Aug 2026" },
    ],
  },
  {
    id: "CMP-504",
    category: "Transport",
    subject: "Evening bus skips college stop",
    description: "The 6:30 PM city bus has been skipping the main gate stop this week.",
    status: "open",
    createdAt: "14 Aug 2026",
    raisedByName: "Dr. Neha Gupta",
    raisedByRole: "staff",
    comments: [],
  },
]
