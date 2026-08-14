"use client"

import { useState } from "react"
import { BadgeCheck, Banknote, CheckCircle2, Download, Landmark, Lock, Receipt as ReceiptIcon, Smartphone, Wallet, CreditCard } from "lucide-react"
import { FEE_STRUCTURE, RECEIPTS, METHOD_LABEL, formatINR, type FeeItem, type PaymentMethod, type Receipt } from "@/lib/data/fees"
import { DEMO_USERS } from "@/lib/mock-data"
import { useLocalStorage } from "@/lib/storage"
import { downloadHtml } from "@/lib/download"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

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
  const [fees, setFees] = useLocalStorage<FeeItem[]>("flowdesk.fees", FEE_STRUCTURE)
  const [receipts, setReceipts] = useLocalStorage<Receipt[]>("flowdesk.receipts", RECEIPTS)
  const [tab, setTab] = useState<string>("dues")
  const [paying, setPaying] = useState<FeeItem | null>(null)
  const [step, setStep] = useState<"method" | "processing" | "success">("method")
  const [method, setMethod] = useState<PaymentMethod>("upi")
  const [newReceipt, setNewReceipt] = useState<Receipt | null>(null)

  const me = DEMO_USERS.student
  const pending = fees.filter((f) => f.status === "pending")
  const paid = fees.filter((f) => f.status === "paid")
  const totalDue = pending.reduce((s, f) => s + f.amount, 0)
  const totalPaid = paid.reduce((s, f) => s + f.amount, 0)

  const startPay = (fee: FeeItem) => {
    setPaying(fee)
    setMethod("upi")
    setStep("method")
    setNewReceipt(null)
  }

  const confirm = () => {
    if (!paying) return
    setStep("processing")
    setTimeout(() => {
      const receipt: Receipt = {
        id: `RCP-${Math.floor(7002 + Math.random() * 900)}`,
        studentId: me.id,
        studentName: me.name,
        itemName: paying.name,
        amount: paying.amount,
        date: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
        method,
        transactionId: `TXN-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      }
      setFees((prev) =>
        prev.map((f) =>
          f.id === paying.id
            ? {
                ...f,
                status: "paid",
                paidDate: receipt.date,
                method: receipt.method,
                receiptId: receipt.id,
              }
            : f,
        ),
      )
      setReceipts((prev) => [receipt, ...prev])
      setNewReceipt(receipt)
      setStep("success")
    }, 1800)
  }

  const closeModal = () => {
    setPaying(null)
    setNewReceipt(null)
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
                const body = `
                  <div class="head">
                    <div>
                      <h1>FlowDesk — Fee Receipt</h1>
                      <p class="muted">${newReceipt.date}</p>
                    </div>
                    <span class="badge">PAID</span>
                  </div>
                  <div class="grid">
                    <div><p class="muted">Receipt No</p><b>${newReceipt.id}</b></div>
                    <div><p class="muted">Student</p><b>${newReceipt.studentName}</b></div>
                    <div><p class="muted">Roll No</p><b>${newReceipt.studentId}</b></div>
                    <div><p class="muted">Transaction</p><b>${newReceipt.transactionId}</b></div>
                  </div>
                  <table>
                    <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>${newReceipt.itemName}</td><td class="right">${formatINR(newReceipt.amount)}</td></tr>
                      <tr class="total"><td>Total paid via ${METHOD_LABEL[newReceipt.method]}</td><td class="right">${formatINR(newReceipt.amount)}</td></tr>
                    </tbody>
                  </table>
                  <p class="note">This is a digitally generated receipt from FlowDesk for the transaction above. No physical copy is required.</p>`
                downloadHtml(`receipt-${newReceipt.id}.html`, "Fee Receipt", body)
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
              onClick={() => {
                const body = `
                  <div class="head">
                    <div>
                      <h1>FlowDesk — Fee Receipt</h1>
                      <p class="muted">${r.date}</p>
                    </div>
                    <span class="badge">PAID</span>
                  </div>
                  <div class="grid">
                    <div><p class="muted">Receipt No</p><b>${r.id}</b></div>
                    <div><p class="muted">Student</p><b>${r.studentName}</b></div>
                    <div><p class="muted">Roll No</p><b>${r.studentId}</b></div>
                    <div><p class="muted">Transaction</p><b>${r.transactionId}</b></div>
                  </div>
                  <table>
                    <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>${r.itemName}</td><td class="right">${formatINR(r.amount)}</td></tr>
                      <tr class="total"><td>Total paid via ${METHOD_LABEL[r.method]}</td><td class="right">${formatINR(r.amount)}</td></tr>
                    </tbody>
                  </table>
                  <p class="note">This is a digitally generated receipt from FlowDesk for the transaction above. No physical copy is required.</p>`
                downloadHtml(`receipt-${r.id}.html`, "Fee Receipt", body)
              }}
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
