import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "@/lib/db/password"

describe("password hashing", () => {
  it("round-trips a valid password", () => {
    const hash = hashPassword("campus123")
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(verifyPassword("campus123", hash)).toBe(true)
  })

  it("rejects a wrong password", () => {
    const hash = hashPassword("campus123")
    expect(verifyPassword("wrong-password", hash)).toBe(false)
  })

  it("is salted (different hashes for same password)", () => {
    expect(hashPassword("campus123")).not.toBe(hashPassword("campus123"))
  })
})
