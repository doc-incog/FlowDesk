"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Send, X } from "lucide-react"
import { CHAT_FAQ, CHAT_FALLBACK, CHAT_SUGGESTIONS } from "@/lib/data/chat"
import { cn } from "@/lib/utils"

type Message = { id: string; from: "bot" | "user"; text: string }

let msgSeq = 0

function answerFor(text: string): string {
  const t = text.toLowerCase()
  let best = { score: 0, answer: CHAT_FALLBACK }
  for (const q of CHAT_FAQ) {
    let score = 0
    for (const k of q.keywords) if (t.includes(k)) score += 1
    if (score > best.score) best = { score, answer: q.answer }
  }
  return best.score > 0 ? best.answer : CHAT_FALLBACK
}

export function AIChat() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m0",
      from: "bot",
      text: "Hi! I am Flow, your campus assistant. Ask me about fees, exams, admissions, scholarships, timings or anything else.",
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, typing, open])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || typing) return
    setMessages((m) => [...m, { id: `u${msgSeq++}`, from: "user", text: trimmed }])
    setInput("")
    setTyping(true)
    setTimeout(() => {
      setMessages((m) => [...m, { id: `b${msgSeq++}`, from: "bot", text: answerFor(trimmed) }])
      setTyping(false)
    }, 900)
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[28rem] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-border bg-secondary px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">Flow Assistant</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> Online · campus knowledge base
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.from === "user" && "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.from === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-secondary-foreground",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-md bg-secondary px-4 py-2.5">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 120}ms` }}
                        aria-hidden
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CHAT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the campus…"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="submit"
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                disabled={!input.trim() || typing}
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <Bot className="h-6 w-6" aria-hidden />}
      </button>
    </>
  )
}
