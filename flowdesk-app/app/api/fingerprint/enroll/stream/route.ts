import { subscribeSSE, notifyEnrollmentEvent } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — SSE endpoint for real-time enrollment wizard updates.
 *  Query: ?deviceId=ESP-XXXXXXXX&userId=STU-0001
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get("deviceId")
  const userId = searchParams.get("userId")

  if (!deviceId || !userId) {
    return new Response(JSON.stringify({ error: "deviceId and userId are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", deviceId, userId })}\n\n`))

      // Subscribe to device events
      const unsubscribe = subscribeSSE(deviceId, controller)

      // Send heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 15000)

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        unsubscribe()
        try { controller.close() } catch {}
      })

      // Timeout after 3 minutes
      setTimeout(() => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "timeout" })}\n\n`))
          controller.close()
        } catch {}
      }, 180000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
