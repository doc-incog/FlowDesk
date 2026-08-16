"use client"

import { useEffect, useState } from "react"
import { AlertCircle, BadgeCheck, Banknote, CheckCircle2, Download, Landmark, Lock, Receipt as ReceiptIcon, Smartphone, Wallet, CreditCard } from "lucide-react"
import type { UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

async function downloadReceipt(id: string) {
  const res = await fetch(`/api/receipts/${id}/pdf`)
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `receipt-${id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type PaymentMethod = "upi" | "card" | "netbanking" | "cash"

type FeeItem = {
  id: string
  name: string
  amount: number
  dueDate: string
  status: "paid" | "pending"
  paidDate?: string
  method?: PaymentMethod
  receiptId?: string
}

type Receipt = {
  id: string
  studentId: string
  studentName: string
  itemName: string
  amount: number
  date: string
  method: PaymentMethod
  transactionId: string
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net Banking",
  cash: "Cash",
}

const TABS: TabItem[] = [
  { id: "dues", label: "Fee dues" },
  { id: "receipts", label: "Receipts" },
]

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: "upi", label: "UPI", icon: <Smartphone className="h-4 w-4" aria-hidden /> },
  { id: "card", label: "Card", icon: <CreditCard className="h-4 w-4" aria-hidden /> },
  { id: "netbanking", label: "Net Banking", icon: <Landmark className="h-4 w-4" aria-hidden /> },
]

export function FeesSection() {
  const [fees, setFees] = useState<FeeItem[] | null>(null)
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const [me, setMe] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("dues")
  const [paying, setPaying] = useState<FeeItem | null>(null)
  const [step, setStep] = useState<"method" | "processing" | "success">("method")
  const [method, setMethod] = useState<PaymentMethod>("upi")
  const [newReceipt, setNewReceipt] = useState<Receipt | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/fees").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([f, m]) => {
        if (!alive) return
        if (f?.error) setError(f.error)
        else {
          setFees(f.feeStructure ?? [])
          setReceipts(f.receipts ?? [])
        }
        if (m?.user) setMe(m.user)
        else if (m?.error && !f?.error) setError(m.error)
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!fees || !receipts || !me) return <p className="text-sm text-muted-foreground">Loading…</p>

  const pending = fees.filter((f) => f.status === "pending")
  const paid = fees.filter((f) => f.status === "paid")
  const totalDue = pending.reduce((s, f) => s + f.amount, 0)
  const totalPaid = paid.reduce((s, f) => s + f.amount, 0)

  const startPay = (fee: FeeItem) => {
    setPaying(fee)
    setMethod("upi")
    setStep("method")
    setNewReceipt(null)
    setPayError(null)
  }

  const confirm = async () => {
    if (!paying) return
    setStep("processing")
    setPayError(null)
    try {
      const res = await fetch(`/api/fees/${paying.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (!res.ok || !data.receipt) throw new Error(data.error ?? "Payment failed")
      const receipt = data.receipt as Receipt
      setFees((prev) =>
        (prev ?? []).map((f) =>
          f.id === paying.id
            ? { ...f, status: "paid", paidDate: receipt.date, method: receipt.method, receiptId: receipt.id }
            : f,
        ),
      )
      setReceipts((prev) => [receipt, ...(prev ?? [])])
      setNewReceipt(receipt)
      setStep("success")
    } catch (err) {
      setStep("method")
      setPayError(err instanceof Error ? err.message : "Payment failed")
    }
  }

  const closeModal = () => {
    setPaying(null)
    setNewReceipt(null)
    setPayError(null)
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Online Fees"
        description="Pay semester dues instantly — UPI, card or net banking. Digital receipts are generated automatically."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total due" value={formatINR(totalDue)} icon={<Banknote className="h-5 w-5" />} tone="warning" />
        <StatCard label="Paid this semester" value={formatINR(totalPaid)} icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Pending items" value={pending.length} icon={<ReceiptIcon className="h-5 w-5" />} tone="primary" />
      </div>

      <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "dues" && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Fee item</th>
                <th className="pb-2 text-right font-medium">Amount</th>
                <th className="pb-2 font-medium">Due date</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fees.map((f) => (
                <tr key={f.id}>
                  <td className="py-3 font-medium">{f.name}</td>
                  <td className="py-3 text-right font-mono font-semibold">{formatINR(f.amount)}</td>
                  <td className="py-3 text-muted-foreground">{f.dueDate}</td>
                  <td className="py-3">
                    {f.status === "paid" ? (
                      <span className="pill bg-success/10 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Paid · {METHOD_LABEL[f.method ?? "upi"]}
                      </span>
                    ) : (
                      <span className="pill bg-warning/15 text-warning">Pending</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {f.status === "paid" ? (
                      <span className="font-mono text-xs text-muted-foreground">{f.receiptId}</span>
                    ) : (
                      <button
                        onClick={() => startPay(f)}
                        className="rounded-sm bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Pay now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "receipts" && <ReceiptsList receipts={receipts} />}

      <Modal
        open={paying !== null}
        onClose={closeModal}
        title={step === "success" ? "Payment successful" : `Pay — ${paying?.name ?? ""}`}
      >
        {step === "method" && paying && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/60 px-4 py-3">
              <div>
                <p className="text-sm text-muted-foreground">Amount to pay</p>
                <p className="font-mono text-2xl font-bold text-primary">{formatINR(paying.amount)}</p>
              </div>
              <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Choose payment method</p>
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
                    method === m.id ? "border-primary bg-primary/[0.04]" : "border-border hover:bg-secondary",
                  )}
                >
                  <span className="text-primary">{m.icon}</span>
                  {m.label}
                  {method === m.id && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" aria-hidden />}
                </button>
              ))}
            </div>
            <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              This is a simulated payment — no real money is moved. The receipt is generated instantly.
            </div>
            {payError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{payError}</span>
              </div>
            )}
            <button
              onClick={confirm}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Lock className="h-4 w-4" aria-hidden /> Pay {formatINR(paying.amount)} securely
            </button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" aria-hidden />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Wallet className="h-6 w-6" aria-hidden />
              </span>
            </span>
            <p className="text-sm font-medium">Processing payment…</p>
            <p className="text-xs text-muted-foreground">Please don&apos;t close this window.</p>
          </div>
        )}

        {step === "success" && newReceipt && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </span>
              <div>
                <p className="font-bold">Payment received</p>
                <p className="text-sm text-muted-foreground">{formatINR(newReceipt.amount)} · {METHOD_LABEL[newReceipt.method]}</p>
              </div>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm">
              <dl className="space-y-1">
                <div className="flex justify-between"><dt className="text-muted-foreground">Receipt</dt><dd className="font-mono font-semibold">{newReceipt.id}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Transaction</dt><dd className="font-mono">{newReceipt.transactionId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd>{newReceipt.date}</dd></div>
              </dl>
            </div>
            <button
              onClick={() => {
                downloadReceipt(newReceipt.id)
                closeModal()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" aria-hidden /> Download receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ReceiptsList({ receipts }: { receipts: Receipt[] }) {
  return (
    <div className="space-y-3">
      {receipts.map((r) => (
        <Card key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
            <ReceiptIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.itemName}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {r.id} · {r.transactionId} · {r.date}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold">{formatINR(r.amount)}</span>
            <span className="pill bg-secondary text-muted-foreground">
              {METHOD_LABEL[r.method]}
            </span>
            <button
              onClick={() => downloadReceipt(r.id)}
              aria-label={`Download receipt ${r.id}`}
              className="rounded-sm border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Download className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Card>
      ))}
      {receipts.length === 0 && (
        <Card className="py-10 text-center text-sm text-muted-foreground">No receipts yet.</Card>
      )}
    </div>
  )
}
