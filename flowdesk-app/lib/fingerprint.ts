import { getDb } from "@/lib/db"
import crypto from "crypto"

export const FP_TEMPLATE_SIZE = 512
export const FP_MAX_SLOTS_R307 = 162
export const FP_MAX_SLOTS_R309 = 300
export const FP_MATCH_THRESHOLD = 50

const SENSOR_SLOTS: Record<string, number> = { R307: 162, R309: 300 }

/** Generate a random device secret for ESP authentication. */
export function generateDeviceSecret(): string {
  return crypto.randomBytes(24).toString("hex")
}

/** Validate device auth from Authorization header. Returns deviceId if valid, null otherwise. */
export async function requireDeviceAuth(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) return null
  const token = auth.slice(7)
  if (!token) return null

  const db = getDb()
  const row = db
    .prepare("SELECT device_id FROM fingerprint_devices WHERE device_secret = ? AND status = 'approved'")
    .get(token) as { device_id: string } | undefined
  return row?.device_id ?? null
}

/** Auth helper: require device auth or session admin. Returns deviceId or throws. */
export async function requireFingerprintAuth(
  request: Request,
  opts: { requireAdmin?: boolean } = {},
): Promise<{ deviceId: string; source: "device" | "admin" }> {
  // Try device auth first
  const deviceId = await requireDeviceAuth(request)
  if (deviceId) return { deviceId, source: "device" }

  // Fall back to session auth
  const { getSessionUser } = await import("@/lib/auth")
  const user = await getSessionUser()
  if (!user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } })
  if (opts.requireAdmin && user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "content-type": "application/json" } })
  }
  // For admin session, deviceId must come from query/body — caller handles this
  return { deviceId: "", source: "admin" }
}

/** Compare two fingerprint templates byte-wise and return a confidence score (0-100). */
export function compareTemplates(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) return 0
  let matching = 0
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i])
    if (diff < 20) matching++
  }
  return Math.round((matching / a.length) * 100)
}

/** Find the best matching user for a given fingerprint template on a specific device. */
export function matchTemplate(
  incoming: Buffer,
  deviceId: string,
  threshold: number = FP_MATCH_THRESHOLD,
): { userId: string; fingerId: number; confidence: number } | null {
  const db = getDb()
  const rows = db
    .prepare("SELECT user_id, finger_id, template FROM fingerprint_templates WHERE device_id = ? AND template IS NOT NULL")
    .all(deviceId) as { user_id: string; finger_id: number; template: Buffer }[]

  let best = null
  for (const row of rows) {
    const confidence = compareTemplates(incoming, row.template)
    if (confidence >= threshold && (!best || confidence > best.confidence)) {
      best = { userId: row.user_id, fingerId: row.finger_id, confidence }
    }
  }
  return best
}

/** Look up which user owns a given finger_id on a device. */
export function lookupByFingerId(deviceId: string, fingerId: number): { userId: string; name: string } | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT ft.user_id, u.name FROM fingerprint_templates ft
       JOIN users u ON u.id = ft.user_id
       WHERE ft.device_id = ? AND ft.finger_id = ?`,
    )
    .get(deviceId, fingerId) as { user_id: string; name: string } | undefined
  return row ? { userId: row.user_id, name: row.name } : null
}

/** Get the next available finger slot for a device. */
export function nextAvailableSlot(deviceId: string): number {
  const db = getDb()
  const device = db.prepare("SELECT slots_total FROM fingerprint_devices WHERE device_id = ?").get(deviceId) as { slots_total: number } | undefined
  const maxSlots = device?.slots_total ?? FP_MAX_SLOTS_R307
  const used = db
    .prepare("SELECT finger_id FROM fingerprint_templates WHERE device_id = ?")
    .all(deviceId) as { finger_id: number }[]
  const usedSet = new Set(used.map((r) => r.finger_id))
  for (let i = 1; i <= maxSlots; i++) {
    if (!usedSet.has(i)) return i
  }
  return -1
}

/** Get the max slots for a sensor type. */
export function getMaxSlots(sensorType: string): number {
  return SENSOR_SLOTS[sensorType] ?? FP_MAX_SLOTS_R307
}

/** Enqueue a command for an ESP device to execute. */
export function enqueueCommand(
  deviceId: string,
  command: string,
  params: Record<string, unknown> = {},
): string {
  const db = getDb()
  const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO fingerprint_commands (id, device_id, command, params, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
  ).run(id, deviceId, command, JSON.stringify(params), now)
  notifySSESubscribers(deviceId, { type: "command-queued", command, commandId: id })
  return id
}

/** Get the next pending command for a device. */
export function getNextCommand(deviceId: string): { id: string; command: string; params: Record<string, unknown> } | null {
  const db = getDb()
  const row = db
    .prepare(
      "SELECT id, command, params FROM fingerprint_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1",
    )
    .get(deviceId) as { id: string; command: string; params: string } | undefined
  if (!row) return null
  db.prepare("UPDATE fingerprint_commands SET status = 'sent' WHERE id = ?").run(row.id)
  return { id: row.id, command: row.command, params: JSON.parse(row.params) }
}

/** Mark a command as completed or failed. */
export function completeCommand(commandId: string, status: "completed" | "failed", result?: unknown) {
  const db = getDb()
  db.prepare("UPDATE fingerprint_commands SET status = ?, completed_at = ? WHERE id = ?").run(
    status,
    new Date().toISOString(),
    commandId,
  )
  // Find the device for this command to notify SSE subscribers
  const cmd = db.prepare("SELECT device_id FROM fingerprint_commands WHERE id = ?").get(commandId) as { device_id: string } | undefined
  if (cmd) {
    notifySSESubscribers(cmd.device_id, { type: "command-result", commandId, status, result })
  }
}

/** Upsert a device record (heartbeat). Returns true if device is new. */
export function heartbeatDevice(deviceId: string, meta?: { sensorType?: string; sensorCapacity?: number }): boolean {
  const db = getDb()
  const now = new Date().toISOString()
  const existing = db.prepare("SELECT device_id, status FROM fingerprint_devices WHERE device_id = ?").get(deviceId) as { device_id: string; status: string } | undefined

  if (existing) {
    const enrolled = (db.prepare("SELECT COUNT(*) AS n FROM fingerprint_templates WHERE device_id = ?").get(deviceId) as { n: number }).n
    const updates = ["last_seen = ?", "enrolled_count = ?"]
    const params: (string | number)[] = [now, enrolled]
    if (meta?.sensorCapacity != null) {
      updates.push("slots_total = ?")
      params.push(meta.sensorCapacity)
    }
    params.push(deviceId)
    db.prepare(`UPDATE fingerprint_devices SET ${updates.join(", ")} WHERE device_id = ?`).run(...params)
    return false
  } else {
    const sensorType = meta?.sensorType ?? "R307"
    const slotsTotal = meta?.sensorCapacity ?? getMaxSlots(sensorType)
    db.prepare(
      "INSERT INTO fingerprint_devices (device_id, sensor_type, status, last_seen, enrolled_count, slots_total, created_at) VALUES (?, ?, 'pending', ?, 0, ?, ?)",
    ).run(deviceId, sensorType, now, slotsTotal, now)
    return true
  }
}

/** Record a health check from an ESP device. */
export function recordDeviceHealth(
  deviceId: string,
  data: {
    sensorConnected: boolean
    sensorCapacity?: number
    freeMemory?: number
    wifiRssi?: number
    uptimeSeconds?: number
  },
) {
  const db = getDb()
  const id = `fhp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO fingerprint_device_health (id, device_id, sensor_connected, sensor_capacity, free_memory, wifi_rssi, uptime_seconds, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    deviceId,
    data.sensorConnected ? 1 : 0,
    data.sensorCapacity ?? null,
    data.freeMemory ?? null,
    data.wifiRssi ?? null,
    data.uptimeSeconds ?? null,
    now,
  )
}

// ============================================================
// SSE (Server-Sent Events) — in-process event emitter
// ============================================================
type SSESubscriber = {
  controller: ReadableStreamDefaultController
  deviceId: string
}

const sseSubscribers = new Map<string, Set<SSESubscriber>>()

/** Subscribe an SSE stream to device events. Returns unsubscribe function. */
export function subscribeSSE(deviceId: string, controller: ReadableStreamDefaultController): () => void {
  if (!sseSubscribers.has(deviceId)) sseSubscribers.set(deviceId, new Set())
  const sub = { controller, deviceId }
  sseSubscribers.get(deviceId)!.add(sub)
  return () => {
    sseSubscribers.get(deviceId)?.delete(sub)
    if (sseSubscribers.get(deviceId)?.size === 0) sseSubscribers.delete(deviceId)
  }
}

/** Push an event to all SSE subscribers for a device. */
function notifySSESubscribers(deviceId: string, data: Record<string, unknown>) {
  const subs = sseSubscribers.get(deviceId)
  if (!subs || subs.size === 0) return
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const sub of subs) {
    try {
      sub.controller.enqueue(new TextEncoder().encode(payload))
    } catch {
      subs.delete(sub)
    }
  }
}

/** Notify SSE subscribers about an enrollment status update. */
export function notifyEnrollmentEvent(deviceId: string, event: {
  type: "enrollment-started" | "enrollment-progress" | "enrollment-complete" | "enrollment-failed"
  userId?: string
  fingerId?: number
  step?: string
  message?: string
}) {
  notifySSESubscribers(deviceId, event)
}
