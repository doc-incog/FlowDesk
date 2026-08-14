export type Program = {
  id: string
  name: string
  duration: string
  seats: number
  deadline: string
  fee: number
}

export type AdmissionStatus = "submitted" | "reviewing" | "accepted" | "rejected"

export type AdmissionApplication = {
  id: string
  applicantName: string
  email: string
  programId: string
  programName: string
  score: number
  docs: string[]
  status: AdmissionStatus
  submittedAt: string
  notes: string
}

export const PROGRAMS: Program[] = [
  { id: "P1", name: "B.Tech — Computer Science", duration: "4 years", seats: 120, deadline: "30 Aug 2026", fee: 85000 },
  { id: "P2", name: "B.Tech — Electronics & Communication", duration: "4 years", seats: 60, deadline: "30 Aug 2026", fee: 78000 },
  { id: "P3", name: "B.Sc — Computer Science", duration: "3 years", seats: 40, deadline: "25 Aug 2026", fee: 42000 },
  { id: "P4", name: "M.Tech — Computer Science", duration: "2 years", seats: 30, deadline: "20 Sep 2026", fee: 98000 },
  { id: "P5", name: "MBA — General", duration: "2 years", seats: 60, deadline: "15 Sep 2026", fee: 110000 },
]

export const ADMISSION_APPLICATIONS: AdmissionApplication[] = [
  { id: "APP-2041", applicantName: "Riya Nair", email: "riya.nair@example.com", programId: "P1", programName: "B.Tech — Computer Science", score: 92, docs: ["marksheet.pdf", "id_proof.jpg"], status: "reviewing", submittedAt: "02 Aug 2026", notes: "Verified documents, awaiting entrance score." },
  { id: "APP-2042", applicantName: "Arjun Mehta", email: "arjun.mehta@example.com", programId: "P2", programName: "B.Tech — Electronics & Communication", score: 84, docs: ["marksheet.pdf"], status: "submitted", submittedAt: "05 Aug 2026", notes: "" },
  { id: "APP-2043", applicantName: "Sana Iqbal", email: "sana.iqbal@example.com", programId: "P3", programName: "B.Sc — Computer Science", score: 88, docs: ["marksheet.pdf", "id_proof.jpg"], status: "accepted", submittedAt: "28 Jul 2026", notes: "Provisional offer sent." },
  { id: "APP-2044", applicantName: "Kabir Das", email: "kabir.das@example.com", programId: "P4", programName: "M.Tech — Computer Science", score: 76, docs: ["degree.pdf"], status: "rejected", submittedAt: "20 Jul 2026", notes: "GATE score below cutoff." },
]

export function nextAdmissionStatus(s: AdmissionStatus): AdmissionStatus | null {
  if (s === "submitted") return "reviewing"
  if (s === "reviewing") return "accepted"
  return null
}
