"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageSquare, EyeOff, Plus, Send, Search, Trash2 } from "lucide-react"
import type { UserProfile } from "@/lib/seed-data/core"
import { Avatar, Card, SectionHeading } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

type Participant = { id: string; name: string; avatarInitials: string; role: string; deleted?: boolean }

type Conversation = {
  id: string
  type: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessage: string
  lastSenderId: string
  lastMessageAt: string
  unreadCount: number
  participants: Participant[]
}

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  senderInitials: string
  content: string
  type: string
  createdAt: string
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

export function ChatSection({ role }: { role: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [me, setMe] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [confirmingHideId, setConfirmingHideId] = useState<string | null>(null)
  const [sidebarFilter, setSidebarFilter] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/conversations").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([conv, auth]) => {
        if (!alive) return
        if (conv?.error) setError(conv.error)
        else setConversations(conv.conversations ?? [])
        if (auth?.user) setMe(auth.user)
        else if (auth?.error && !conv?.error) setError(auth.error)
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations")
      const d = await res.json()
      if (d?.conversations) setConversations(d.conversations)
    } catch {
      // Sidebar refreshes on the next poll
    }
  }, [])

  // Keep the sidebar live: new conversations, unread badges, last messages.
  useEffect(() => {
    let alive = true
    const timer = setInterval(() => {
      if (!alive) return
      refreshConversations()
    }, 4000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [refreshConversations])

  useEffect(() => {
    if (!activeId) return
    let alive = true
    const poll = () => {
      fetch(`/api/conversations/${activeId}/messages`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive || !d?.messages) return
          setMessages((prev) => {
            // Skip state churn when nothing changed so polling doesn't fight scrolling.
            const last = d.messages[d.messages.length - 1]
            if (
              prev.length === d.messages.length &&
              prev[prev.length - 1]?.id === last?.id &&
              prev[0]?.id === d.messages[0]?.id
            ) {
              return prev
            }
            return d.messages
          })
        })
        .catch(() => {})
    }
    poll()
    const timer = setInterval(poll, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [activeId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const loadMessages = async (id: string) => {
    setActiveId(id)
    setMessages([])
    try {
      const res = await fetch(`/api/conversations/${id}/messages`)
      const d = await res.json()
      if (d?.messages) setMessages(d.messages)
    } catch {
      // Messages will be fetched on next poll
    }
  }

  const searchUsers = async (q: string) => {
    if (!q.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`)
      const d = await res.json()
      setSearchResults(d?.users ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const startConversation = async (userId: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: [userId] }),
      })
      const d = await res.json()
      // The API answers with { conversationId } (existing or newly created).
      const conversationId = d?.conversation?.id ?? d?.conversationId
      if (conversationId) {
        await refreshConversations()
        loadMessages(conversationId)
      }
    } catch {
      // Handled silently
    }
    setShowNewChat(false)
    setSearchQuery("")
    setSearchResults([])
  }

  const sendMessage = async () => {
    if (!activeId || !newMessage.trim() || sending) return
    setSending(true)
    const content = newMessage.trim()
    setNewMessage("")
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const d = await res.json()
      if (d?.message) {
        setMessages((prev) => [...prev, d.message])
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? { ...c, lastMessage: content, lastSenderId: me?.id ?? "", lastMessageAt: new Date().toISOString() }
              : c,
          ),
        )
      }
    } catch {
      // Will be caught on next poll
    } finally {
      setSending(false)
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeId)

  // For a direct chat, the "other" participant may have been deleted. Their
  // messages remain readable but the thread becomes read-only.
  const otherDeleted =
    activeConversation?.type === "direct" &&
    (activeConversation.participants.find((p) => p.id !== me?.id)?.deleted ?? false)

  // Deleting a conversation removes it for everyone, so clear the open thread
  // if it is the one being deleted.
  const hideConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}?action=hide`, { method: "DELETE" })
    } catch {
      // The sidebar refresh below will reconcile the list
    }
    setConfirmingHideId(null)
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
    }
    refreshConversations()
  }

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}?action=delete`, { method: "DELETE" })
    } catch {
      // The sidebar refresh below will reconcile the list
    }
    setConfirmingDeleteId(null)
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
    }
    refreshConversations()
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Messages"
        description="Chat with students, staff, and administrators."
        action={
          <button
            onClick={() => setShowNewChat(!showNewChat)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden /> New chat
          </button>
        }
      />

      {showNewChat && (
        <Card className="space-y-3">
          <p className="text-sm font-medium">Start a new conversation</p>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                searchUsers(e.target.value)
              }}
              type="search"
              placeholder="Search people…"
              aria-label="Search users to start a conversation"
              className="w-full rounded-sm border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConversation(u.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <Avatar initials={u.avatarInitials} className="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.roleLabel ?? u.role} · {u.department}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.trim() && !searching && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground">No users found.</p>
          )}
        </Card>
      )}

      <div className="flex h-[600px] gap-4 overflow-hidden rounded-xl border border-border bg-card/50">
        {/* Conversation list */}
        <div className="flex w-80 shrink-0 flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={sidebarFilter}
                onChange={(e) => setSidebarFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  const q = sidebarFilter.trim().toLowerCase()
                  const visible = q ? conversations.filter((c) => c.title.toLowerCase().includes(q) || c.participants.some((p) => p.name.toLowerCase().includes(q)) || (c.lastMessage ?? "").toLowerCase().includes(q)) : conversations
                  if (visible.length > 0) loadMessages(visible[0].id)
                }}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="w-full rounded-sm border border-input bg-card py-2 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-6 w-6" aria-hidden />
                <p>No conversations yet.</p>
                <p className="text-xs">Start one by clicking &quot;New chat&quot; above.</p>
              </div>
            )}
            {(() => {
              const q = sidebarFilter.trim().toLowerCase()
              const visible = q
                ? conversations.filter(
                    (c) =>
                      c.title.toLowerCase().includes(q) ||
                      c.participants.some((p) => p.name.toLowerCase().includes(q)) ||
                      (c.lastMessage ?? "").toLowerCase().includes(q),
                  )
                : conversations
              if (conversations.length > 0 && visible.length === 0) {
                return (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No conversations match.</p>
                )
              }
              return visible.map((conv) => {
                const other = conv.participants.find((p) => p.id !== me?.id)
                const isActive = conv.id === activeId
                const confirmingDelete = confirmingDeleteId === conv.id
                const confirmingHide = confirmingHideId === conv.id
                const confirming = confirmingDelete || confirmingHide
                return (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (confirmingDeleteId && confirmingDeleteId !== conv.id) setConfirmingDeleteId(null)
                      if (confirmingHideId && confirmingHideId !== conv.id) setConfirmingHideId(null)
                      loadMessages(conv.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadMessages(conv.id)
                    }}
                    className={cn(
                      "group flex w-full cursor-pointer items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors",
                      isActive ? "bg-primary/[0.06]" : "hover:bg-secondary/50",
                    )}
                  >
                    <Avatar
                      initials={other?.avatarInitials ?? initialsFor(conv.title)}
                      className="h-10 w-10 text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {other?.name ?? conv.title}
                        </p>
                        {conv.lastMessageAt && !confirming && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {relativeTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {confirmingDelete
                            ? "Delete permanently?"
                            : confirmingHide
                              ? "Hide conversation?"
                              : conv.lastMessage || "No messages yet"}
                        </p>
                        {confirmingDelete ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteConversation(conv.id)
                              }}
                              className="rounded-sm bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmingDeleteId(null)
                              }}
                              aria-label="Cancel delete"
                              className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                              No
                            </button>
                          </span>
                        ) : confirmingHide ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                hideConversation(conv.id)
                              }}
                              className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-foreground"
                            >
                              Hide
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmingHideId(null)
                              }}
                              aria-label="Cancel hide"
                              className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <>
                            {conv.unreadCount > 0 && (
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                                  {conv.unreadCount}
                                </span>
                              </span>
                            )}
                            <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmingHideId(conv.id)
                                }}
                                aria-label={`Hide conversation with ${other?.name ?? conv.title}`}
                                title="Hide conversation"
                                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmingDeleteId(conv.id)
                                }}
                                aria-label={`Delete conversation with ${other?.name ?? conv.title}`}
                                title="Delete permanently"
                                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeId && activeConversation ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Avatar
                  initials={
                    activeConversation.participants.find((p) => p.id !== me?.id)?.avatarInitials ??
                    initialsFor(activeConversation.title)
                  }
                  className="h-9 w-9 text-xs"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {activeConversation.participants.find((p) => p.id !== me?.id)?.name ??
                      activeConversation.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeConversation.participants.length} participant{activeConversation.participants.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === me?.id
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[70%] rounded-xl px-3.5 py-2.5",
                            isMe ? "bg-primary/10 text-foreground" : "bg-secondary text-foreground",
                          )}
                        >
                          {!isMe && (
                            <p className="mb-0.5 text-xs font-semibold text-primary">{msg.senderName}</p>
                          )}
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {msg.createdAt ? relativeTime(msg.createdAt) : ""}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                      <MessageSquare className="h-6 w-6" aria-hidden />
                      <p>No messages yet. Say hello!</p>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="border-t border-border px-4 py-3">
                {otherDeleted ? (
                  <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-center text-xs text-muted-foreground">
                    This user is no longer available — the conversation is read-only.
                  </p>
                ) : (
                  <div className="flex items-start gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      rows={1}
                      placeholder="Type a message…"
                      aria-label="Message input"
                      className="min-h-[40px] max-h-[120px] w-full resize-none rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      aria-label="Send message"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-10 w-10" aria-hidden />
              <p className="text-sm font-medium">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
