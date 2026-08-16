/** Local-time helpers so dates compare consistently (server local zone). */
const pad = (n: number) => String(n).padStart(2, "0")

export function localDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function localDateTime(now: Date = new Date()): string {
  return `${localDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function clockTime(now: Date = new Date()): string {
  return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}
