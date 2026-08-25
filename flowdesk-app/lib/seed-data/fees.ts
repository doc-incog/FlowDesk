export type PaymentMethod = "ewallet" | "card" | "netbanking" | "cash"

export type FeeItem = {
  id: string
  name: string
  amount: number
  dueDate: string
  status: "paid" | "pending"
  paidDate?: string
  method?: PaymentMethod
  receiptId?: string
}

export type Receipt = {
  id: string
  studentId: string
  studentName: string
  itemName: string
  amount: number
  date: string
  method: PaymentMethod
  transactionId: string
}

export const FEE_STRUCTURE: FeeItem[] = [
  { id: "F1", name: "Tuition Fee", amount: 85000, dueDate: "10 Aug 2026", status: "pending" },
  { id: "F2", name: "Hostel Fee", amount: 42000, dueDate: "15 Aug 2026", status: "pending" },
  { id: "F3", name: "Library Fee", amount: 3000, dueDate: "10 Aug 2026", status: "paid", paidDate: "04 Aug 2026", method: "ewallet", receiptId: "RCP-7001" },
  { id: "F4", name: "Laboratory Fee", amount: 5500, dueDate: "20 Aug 2026", status: "pending" },
  { id: "F5", name: "Examination Fee", amount: 2000, dueDate: "10 Aug 2026", status: "paid", paidDate: "02 Aug 2026", method: "card", receiptId: "RCP-7000" },
  { id: "F6", name: "Transport Fee", amount: 9000, dueDate: "25 Aug 2026", status: "pending" },
]

export const RECEIPTS: Receipt[] = [
  { id: "RCP-7000", studentId: "STU-2043", studentName: "Aisha Karim", itemName: "Examination Fee", amount: 2000, date: "02 Aug 2026", method: "card", transactionId: "TXN-8812-4471" },
  { id: "RCP-7001", studentId: "STU-2043", studentName: "Aisha Karim", itemName: "Library Fee", amount: 3000, date: "04 Aug 2026", method: "ewallet", transactionId: "TXN-8812-4590" },
]

export function formatNPR(n: number): string {
  return `Rs. ${n.toLocaleString("en-NP")}`
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  ewallet: "E-Wallet",
  card: "Card",
  netbanking: "Net Banking",
  cash: "Cash",
}
