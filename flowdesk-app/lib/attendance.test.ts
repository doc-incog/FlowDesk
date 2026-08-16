import { describe, expect, it } from "vitest"
import { statusFor } from "@/lib/attendance"
import { localDate } from "@/lib/datetime"

describe("statusFor", () => {
  it("marks 09:00 exactly as on-time", () => {
    expect(statusFor("09:00 AM")).toBe("on-time")
  })

  it("marks before 09:00 as on-time", () => {
    expect(statusFor("8:45 AM")).toBe("on-time")
    expect(statusFor("12:03 AM")).toBe("on-time")
  })

  it("marks after 09:00 as late", () => {
    expect(statusFor("09:01 AM")).toBe("late")
    expect(statusFor("11:30 AM")).toBe("late")
    expect(statusFor("2:15 PM")).toBe("late")
  })

  it("falls back to late for unparseable input", () => {
    expect(statusFor("—")).toBe("late")
  })
})

describe("localDate", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(localDate(new Date(2026, 7, 17))).toBe("2026-08-17")
  })

  it("pads single-digit values", () => {
    expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})
