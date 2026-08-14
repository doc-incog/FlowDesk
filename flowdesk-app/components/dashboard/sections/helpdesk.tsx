"use client"

import { useState } from "react"
import { MessageSquare, Plus, Send } from "lucide-react"
import { COMPLAINTS, COMPLAINT_CATEGORIES, type Complaint, type ComplaintCategory, type ComplaintStatus } from "@/lib/data/helpdesk"
import { DEMO_USERS, type Role } from "@/lib/mock-data"
import { useLocalStorage } from "@/lib/storage"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const TABS: TabItem[] = [
  { id: "all", label: "All tickets" },
  { id: "mine", label: "Raised by me" },
  { id: "new", label: "Raise a complaint" },
]

const STATUS_BADGE: Record<ComplaintStatus, string> = {
  open: "pill bg-destructive/10 text-destructive",
  "in-progress": "pill bg-warning/15 text-warning",
  resolved: "pill bg-success/10 text-success",
}

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  resolved: "Resolved",
}

export function HelpdeskSection({ role }: { role: Role }) {
  const [complaints, setComplaints] = useLocalStorage<Complaint[]>("flowdesk.complaints", COMPLAINTS)
  const [tab, setTab] = useState<string>("all")
  const me = DEMO_USERS[role]

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Helpdesk"
        description="Raise complaints and track them to resolution with comments from the concerned office."
      />
      <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "new" && <NewComplaint onCreated={() => setTab("mine")} role={role} setComplaints={setComplaints} />}

      {tab !== "new" && (
        <div className="space-y-4">
          {complaints
            .filter((c) => (tab === "mine" ? c.raisedByName === me.name : true))
            .map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                canUpdate={role !== "student" || c.raisedByName === me.name}
                setComplaints={setComplaints}
              />
            ))}
          {complaints.filter((c) => (tab === "mine" ? c.raisedByName === me.name : true)).length === 0 && (
            <Card className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No complaints found.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function NewComplaint({
  onCreated,
  role,
  setComplaints,
}: {
  onCreated: () => void
  role: Role
  setComplaints: React.Dispatch<React.SetStateAction<Complaint[]>>
}) {
  const me = DEMO_USERS[role]
  const [category, setCategory] = useState<ComplaintCategory>("Academics")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")

  return (
    <Card>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category</label>
          <div className="flex flex-wrap gap-2">
            {COMPLAINT_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  category === c ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of the issue"
            className="w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the issue in detail…"
            className="w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          onClick={() => {
            if (!subject.trim() || !description.trim()) {
              setError("Subject and description are required.")
              return
            }
            const c: Complaint = {
              id: `CMP-${Math.floor(505 + Math.random() * 900)}`,
              category,
              subject: subject.trim(),
              description: description.trim(),
              status: "open",
              createdAt: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
              raisedByName: me.name,
              raisedByRole: role,
              comments: [],
            }
            setComplaints((prev) => [c, ...prev])
            onCreated()
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden /> Raise complaint
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Your complaint is visible to the relevant office. Typical response time is 24 hours.
        </p>
      </div>
    </Card>
  )
}

function ComplaintCard({
  complaint,
  canUpdate,
  setComplaints,
}: {
  complaint: Complaint
  canUpdate: boolean
  setComplaints: React.Dispatch<React.SetStateAction<Complaint[]>>
}) {
  const [expanded, setExpanded] = useState(false)
  const [comment, setComment] = useState("")

  const addComment = () => {
    if (!comment.trim()) return
    const at = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === complaint.id
          ? { ...c, comments: [...c.comments, { id: `cc${Date.now()}`, author: DEMO_USERS.admin.name, text: comment.trim(), at }] }
          : c,
      ),
    )
    setComment("")
  }

  return (
    <Card>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill bg-secondary text-muted-foreground">{complaint.category}</span>
          <span className={cn(STATUS_BADGE[complaint.status])}>
            {STATUS_LABEL[complaint.status]}
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {complaint.id} · {complaint.createdAt}
          </span>
        </div>
        <p className="font-semibold">{complaint.subject}</p>
        <p className="text-sm text-muted-foreground">{complaint.description}</p>
        <p className="text-xs text-muted-foreground">
          Raised by <span className="font-medium text-foreground">{complaint.raisedByName}</span> ({complaint.raisedByRole})
        </p>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <MessageSquare className="h-4 w-4" aria-hidden />
          {complaint.comments.length} comment{complaint.comments.length === 1 ? "" : "s"}
          <span className="text-muted-foreground">{expanded ? "▾" : "▸"}</span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {complaint.comments.map((cm) => (
              <div key={cm.id} className="rounded-md border border-border bg-secondary/50 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cm.author}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{cm.at}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{cm.text}</p>
              </div>
            ))}

            {canUpdate && (
              <div>
                <div className="flex items-start gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addComment()
                    }}
                    placeholder="Add a comment…"
                    className="w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    onClick={addComment}
                    aria-label="Send comment"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {complaint.status !== "resolved" && (
                  <button
                    onClick={() =>
                      setComplaints((prev) => prev.map((c) => (c.id === complaint.id ? { ...c, status: "resolved" } : c)))
                    }
                    className="mt-2 rounded-sm border border-success/40 px-3 py-1.5 text-sm font-semibold text-success transition-colors hover:bg-success/10"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
