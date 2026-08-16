/** Attendance rules: check-in at or before 09:00 is on-time, otherwise late. */
export const CHECKIN_CUTOFF_MINUTES = 9 * 60

export function statusFor(time: string): "on-time" | "late" {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return "late"
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && hours < 12) hours += 12
  if (ampm === "AM" && hours === 12) hours = 0
  return hours * 60 + minutes <= CHECKIN_CUTOFF_MINUTES ? "on-time" : "late"
}
