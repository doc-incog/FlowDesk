"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Fingerprint, Plus, Trash2, RefreshCw, Wifi, WifiOff, Loader2, Search,
  MonitorSmartphone, MapPin, Tag, Pencil, MoreVertical, CheckCircle2,
  XCircle, Activity, ChevronDown, ChevronUp, Shield, AlertTriangle, Settings,
} from "lucide-react"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { Modal } from "@/components/ui/modal"
import { FingerprintEnrollmentWizard } from "@/components/dashboard/sections/fingerprint-enrollment-wizard"
import { cn } from "@/lib/utils"
import type { UserProfile } from "@/lib/seed-data/core"

type Enrollment = {
  id: string
  user_id: string
  user_name: string
  finger_id: number
  device_id: string
  enrolled_by: string | null
  enrolled_at: string
}

type Device = {
  device_id: string
  label: string
  location: string
  sensor_type: string
  status: "pending" | "approved" | "disabled"
  last_seen: string | null
  enrolled_count: number
  slots_total: number
  created_at?: string
  device_secret?: string
}

type HealthRecord = {
  sensor_connected: number
  sensor_capacity: number | null
  free_memory: number | null
  wifi_rssi: number | null
  uptime_seconds: number | null
  recorded_at: string
}

const SENSOR_TYPES = [
  { value: "R307", label: "R307 (162 slots)" },
  { value: "R309", label: "R309 (300 slots)" },
]

const FINGER_NAMES: Record<number, string> = {
  1: "Right Index", 2: "Right Middle", 3: "Right Ring", 4: "Right Pinky", 5: "Right Thumb",
  6: "Left Index", 7: "Left Middle", 8: "Left Ring", 9: "Left Pinky", 10: "Left Thumb",
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function rssiQuality(rssi: number): "good" | "fair" | "poor" {
  if (rssi > -50) return "good"
  if (rssi > -70) return "fair"
  return "poor"
}

export function FingerprintSection() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [people, setPeople] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Add/Edit Device modal
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deviceForm, setDeviceForm] = useState({ deviceId: "", label: "", location: "", sensorType: "R307" })
  const [deviceSaving, setDeviceSaving] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)

  // Delete device modal
  const [deleteDeviceTarget, setDeleteDeviceTarget] = useState<Device | null>(null)
  const [deletingDevice, setDeletingDevice] = useState(false)

  // Delete enrollment confirmation
  const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Device status actions
  const [statusActionTarget, setStatusActionTarget] = useState<Device | null>(null)
  const [statusActionLoading, setStatusActionLoading] = useState(false)

  // Enrollment wizard
  const [wizardUserId, setWizardUserId] = useState("")
  const [wizardUserName, setWizardUserName] = useState("")
  const [wizardDeviceId, setWizardDeviceId] = useState("")
  const [showWizard, setShowWizard] = useState(false)

  // Enrollment form
  const [selectedDevice, setSelectedDevice] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Device detail / health expandable
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null)
  const [deviceHealth, setDeviceHealth] = useState<Record<string, HealthRecord[]>>({})
  const [loadingHealth, setLoadingHealth] = useState<string | null>(null)

  // Device secret display
  const [showSecret, setShowSecret] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [enrollRes, deviceRes, dirRes] = await Promise.all([
        fetch("/api/fingerprint/enroll"),
        fetch("/api/fingerprint/devices"),
        fetch("/api/directory"),
      ])
      const enrollData = await enrollRes.json()
      const deviceData = await deviceRes.json()
      const dirData = await dirRes.json()

      setEnrollments(enrollData.enrollments ?? [])
      setDevices(deviceData.devices ?? [])

      const students = (dirData.students ?? []) as UserProfile[]
      const staff = (dirData.staff ?? []) as UserProfile[]
      setPeople([...students, ...staff].sort((a, b) => a.name.localeCompare(b.name)))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Fetch health for a device
  const fetchHealth = async (deviceId: string) => {
    if (deviceHealth[deviceId]) {
      setDeviceHealth((prev) => { const n = { ...prev }; delete n[deviceId]; return n })
      return
    }
    setLoadingHealth(deviceId)
    try {
      const res = await fetch(`/api/fingerprint/devices/${deviceId}/health`)
      const data = await res.json()
      setDeviceHealth((prev) => ({ ...prev, [deviceId]: data.health ?? [] }))
    } catch {
      // silent
    } finally {
      setLoadingHealth(null)
    }
  }

  // Add/Edit device
  const openAddDevice = () => {
    setEditingDevice(null)
    setDeviceForm({ deviceId: "", label: "", location: "", sensorType: "R307" })
    setDeviceError(null)
    setShowDeviceModal(true)
  }

  const openEditDevice = (device: Device) => {
    setEditingDevice(device)
    setDeviceForm({ deviceId: device.device_id, label: device.label, location: device.location, sensorType: device.sensor_type })
    setDeviceError(null)
    setShowDeviceModal(true)
  }

  const handleSaveDevice = async () => {
    if (!deviceForm.deviceId.trim()) {
      setDeviceError("Device ID is required")
      return
    }
    setDeviceSaving(true)
    setDeviceError(null)
    try {
      if (editingDevice) {
        const res = await fetch(`/api/fingerprint/devices/${editingDevice.device_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: deviceForm.label, location: deviceForm.location, sensorType: deviceForm.sensorType }),
        })
        const data = await res.json()
        if (!res.ok) { setDeviceError(data.error ?? "Failed to update device"); return }
      } else {
        const res = await fetch("/api/fingerprint/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deviceForm),
        })
        const data = await res.json()
        if (!res.ok) { setDeviceError(data.error ?? "Failed to add device"); return }
        if (data.deviceSecret) setShowSecret(data.deviceSecret)
      }
      setShowDeviceModal(false)
      await fetchAll()
    } catch {
      setDeviceError("Failed to communicate with server")
    } finally {
      setDeviceSaving(false)
    }
  }

  // Delete device
  const handleDeleteDevice = async () => {
    if (!deleteDeviceTarget) return
    setDeletingDevice(true)
    try {
      const res = await fetch(`/api/fingerprint/devices/${deleteDeviceTarget.device_id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? "Failed to delete device")
        return
      }
      setDeleteDeviceTarget(null)
      await fetchAll()
    } catch {
      // silent
    } finally {
      setDeletingDevice(false)
    }
  }

  // Device status action (approve/disable)
  const handleStatusAction = async (device: Device, action: "approve" | "disable") => {
    setStatusActionLoading(true)
    try {
      await fetch("/api/fingerprint/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.device_id, action }),
      })
      setStatusActionTarget(null)
      await fetchAll()
    } catch {
      // silent
    } finally {
      setStatusActionLoading(false)
    }
  }

  // Delete enrollment
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/fingerprint/enroll?id=${deleteTarget.id}`, { method: "DELETE" })
      setDeleteTarget(null)
      await fetchAll()
    } catch {
      // silent
    } finally {
      setDeleting(false)
    }
  }

  // Start enrollment wizard
  const startWizard = (userId: string, userName: string, deviceId?: string) => {
    setWizardUserId(userId)
    setWizardUserName(userName)
    setWizardDeviceId(deviceId ?? selectedDevice)
    setShowWizard(true)
  }

  const handleWizardComplete = async () => {
    setShowWizard(false)
    await fetchAll()
  }

  const filteredPeople = searchQuery
    ? people.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : people

  const filteredEnrollments = selectedDevice
    ? enrollments.filter((e) => e.device_id === selectedDevice)
    : enrollments

  const pendingDevices = devices.filter((d) => d.status === "pending")
  const approvedDevices = devices.filter((d) => d.status === "approved")
  const disabledDevices = devices.filter((d) => d.status === "disabled")

  const inputCls =
    "rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  if (loading) {
    return <p role="status" className="text-sm text-muted-foreground">Loading fingerprint data...</p>
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Fingerprint Devices & Enrollment"
        description="Manage ESP8266 fingerprint devices, enroll users, and view registrations."
      />

      {/* Pending devices banner */}
      {pendingDevices.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {pendingDevices.length} Pending Device{pendingDevices.length > 1 ? "s" : ""}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                These devices have connected but need admin approval before they can be used.
              </p>
              <div className="mt-3 space-y-2">
                {pendingDevices.map((d) => (
                  <div key={d.device_id} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-card px-3 py-2">
                    <div>
                      <span className="font-mono text-xs font-semibold">{d.device_id}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{d.sensor_type}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusAction(d, "approve")}
                        disabled={statusActionLoading}
                        className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleStatusAction(d, "disable")}
                        disabled={statusActionLoading}
                        className="flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Device cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Registered Devices
            {approvedDevices.length > 0 && <span className="ml-2 text-muted-foreground font-normal">({approvedDevices.length})</span>}
          </h3>
          <button
            onClick={openAddDevice}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Device
          </button>
        </div>

        {devices.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted-foreground">
            No devices registered yet. Add your first ESP8266 device to get started.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...approvedDevices, ...disabledDevices].map((d) => {
              const isOnline = d.last_seen && d.last_seen > new Date(Date.now() - 5 * 60 * 1000).toISOString()
              const isSelected = selectedDevice === d.device_id
              const isExpanded = expandedDevice === d.device_id
              const fillPct = d.slots_total > 0 ? Math.round((d.enrolled_count / d.slots_total) * 100) : 0
              const isDisabled = d.status === "disabled"
              const health = deviceHealth[d.device_id]
              const latestHealth = health?.[0]

              return (
                <div
                  key={d.device_id}
                  className={cn(
                    "flex flex-col rounded-xl border transition-all",
                    isDisabled
                      ? "border-muted bg-muted/30 opacity-60"
                      : isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <button
                    onClick={() => setSelectedDevice(isSelected ? "" : d.device_id)}
                    className="flex flex-col gap-2 p-4 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-xs font-semibold">{d.device_id}</span>
                        {isDisabled && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Disabled</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isOnline ? (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <Wifi className="h-3 w-3" /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <WifiOff className="h-3 w-3" /> Offline
                          </span>
                        )}
                      </div>
                    </div>
                    {d.label && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{d.label}</span>
                      </div>
                    )}
                    {d.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{d.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{d.sensor_type}</span>
                      <Fingerprint className="h-3 w-3" />
                      <span>{d.enrolled_count} / {d.slots_total} slots</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    {d.last_seen && (
                      <p className="font-mono text-[10px] text-muted-foreground/60">
                        Last seen: {new Date(d.last_seen).toLocaleString()}
                      </p>
                    )}
                  </button>

                  {/* Device actions row */}
                  <div className="flex items-center gap-1 border-t border-border px-3 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); startWizard("", "", d.device_id) }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <Fingerprint className="h-3 w-3" /> Enroll
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditDevice(d) }}
                      className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
                      title="Edit device"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteDeviceTarget(d) }}
                      className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Delete device"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); fetchHealth(d.device_id) }}
                      className={cn(
                        "rounded-lg border border-border px-2 py-1.5 text-xs transition-colors",
                        isExpanded ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary",
                      )}
                      title="Health info"
                    >
                      <Activity className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Health expandable */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3">
                      {loadingHealth === d.device_id ? (
                        <p className="text-xs text-muted-foreground">Loading health data...</p>
                      ) : health && health.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground">Recent Health</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {latestHealth?.wifi_rssi != null && (
                              <div className={cn("rounded-md px-2 py-1", rssiQuality(latestHealth.wifi_rssi) === "good" ? "bg-emerald-500/10 text-emerald-600" : rssiQuality(latestHealth.wifi_rssi) === "fair" ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive")}>
                                WiFi: {latestHealth.wifi_rssi} dBm
                              </div>
                            )}
                            {latestHealth?.uptime_seconds != null && (
                              <div className="rounded-md bg-secondary px-2 py-1">Up: {formatUptime(latestHealth.uptime_seconds)}</div>
                            )}
                            {latestHealth?.free_memory != null && (
                              <div className="rounded-md bg-secondary px-2 py-1">RAM: {(latestHealth.free_memory / 1024).toFixed(1)}KB free</div>
                            )}
                            {latestHealth?.sensor_connected != null && (
                              <div className={cn("rounded-md px-2 py-1", latestHealth.sensor_connected ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                                Sensor: {latestHealth.sensor_connected ? "OK" : "Disconnected"}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/60">Updated: {new Date(health[0].recorded_at).toLocaleString()}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No health data yet. ESP will report every 60s.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Enrollment panel */}
      <Card className="space-y-4">
        <SectionHeading
          title="Enroll New Fingerprint"
          description="Search for a user, then open the enrollment wizard."
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="fp-device" className="text-xs font-medium text-muted-foreground">Device</label>
            <select
              id="fp-device"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className={cn(inputCls, "min-w-48")}
            >
              <option value="">Select device...</option>
              {approvedDevices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.label || d.device_id} ({d.enrolled_count}/{d.slots_total})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px] relative">
            <label htmlFor="fp-user" className="text-xs font-medium text-muted-foreground">User</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                id="fp-user"
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedUserId("") }}
                className={cn(inputCls, "w-full pl-8")}
              />
            </div>
            {searchQuery && !selectedUserId && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {filteredPeople.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedUserId(p.id); setSearchQuery(`${p.name} (${p.id})`) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                  </button>
                ))}
                {filteredPeople.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No users found</p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (!selectedUserId || !selectedDevice) return
              const person = people.find((p) => p.id === selectedUserId)
              startWizard(selectedUserId, person?.name ?? selectedUserId, selectedDevice)
            }}
            disabled={!selectedDevice || !selectedUserId}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Fingerprint className="h-4 w-4" /> Start Enrollment
          </button>
        </div>
      </Card>

      {/* Enrollments list */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeading
            title="Enrolled Fingerprints"
            description={`${filteredEnrollments.length} enrollment${filteredEnrollments.length === 1 ? "" : "s"}${selectedDevice ? ` on ${selectedDevice}` : ""}`}
          />
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {filteredEnrollments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No enrollments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">User ID</th>
                  <th className="pb-2 font-medium">Finger</th>
                  <th className="pb-2 font-medium">Slot</th>
                  <th className="pb-2 font-medium">Device</th>
                  <th className="pb-2 font-medium">Enrolled By</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEnrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 font-medium">{e.user_name}</td>
                    <td className="py-2.5 font-mono text-muted-foreground">{e.user_id}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{FINGER_NAMES[e.finger_id] ?? `Finger ${e.finger_id}`}</td>
                    <td className="py-2.5 font-mono">{e.finger_id}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{e.device_id}</td>
                    <td className="py-2.5 text-muted-foreground">{e.enrolled_by ?? "—"}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">
                      {new Date(e.enrolled_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setDeleteTarget(e)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Remove enrollment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Device Modal */}
      <Modal
        open={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        title={editingDevice ? "Edit Device" : "Add Fingerprint Device"}
      >
        <div className="space-y-4">
          {deviceError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deviceError}
            </p>
          )}
          {showSecret && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-600">Device Secret (save this!):</p>
              <code className="mt-1 block break-all font-mono text-xs text-foreground">{showSecret}</code>
              <button onClick={() => setShowSecret(null)} className="mt-2 text-xs text-muted-foreground hover:underline">Dismiss</button>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Device ID *</label>
            <input
              type="text"
              placeholder="ESP-A3F2B1C9 (from serial monitor)"
              value={deviceForm.deviceId}
              onChange={(e) => setDeviceForm((f) => ({ ...f, deviceId: e.target.value }))}
              disabled={!!editingDevice}
              className={cn(inputCls, "w-full font-mono", editingDevice && "opacity-60")}
            />
            <p className="text-[11px] text-muted-foreground/60">Find this in the ESP8266 serial monitor on boot.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sensor Type</label>
            <select
              value={deviceForm.sensorType}
              onChange={(e) => setDeviceForm((f) => ({ ...f, sensorType: e.target.value }))}
              className={cn(inputCls, "w-full")}
            >
              {SENSOR_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <input
              type="text"
              placeholder="Main Gate Sensor"
              value={deviceForm.label}
              onChange={(e) => setDeviceForm((f) => ({ ...f, label: e.target.value }))}
              className={cn(inputCls, "w-full")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Location</label>
            <input
              type="text"
              placeholder="Building A Entrance"
              value={deviceForm.location}
              onChange={(e) => setDeviceForm((f) => ({ ...f, location: e.target.value }))}
              className={cn(inputCls, "w-full")}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowDeviceModal(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDevice}
              disabled={deviceSaving || !deviceForm.deviceId.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {deviceSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingDevice ? "Save Changes" : "Add Device"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Device Confirmation */}
      <Modal open={!!deleteDeviceTarget} onClose={() => setDeleteDeviceTarget(null)} title="Delete Device">
        {deleteDeviceTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete device <span className="font-mono text-xs font-semibold">{deleteDeviceTarget.device_id}</span>?
            </p>
            <p className="text-xs text-muted-foreground/60">
              This device must have no enrolled fingerprints before it can be deleted.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteDeviceTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDevice}
                disabled={deletingDevice}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-40"
              >
                {deletingDevice && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Device
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Device Status Action Confirmation */}
      <Modal open={!!statusActionTarget} onClose={() => setStatusActionTarget(null)} title={statusActionTarget?.status === "disabled" ? "Approve Device" : "Disable Device"}>
        {statusActionTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {statusActionTarget.status === "disabled"
                ? `Approve device ${statusActionTarget.device_id}? It will be able to enroll and verify fingerprints.`
                : `Disable device ${statusActionTarget.device_id}? It will stop accepting commands.`}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setStatusActionTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusAction(statusActionTarget, statusActionTarget.status === "disabled" ? "approve" : "disable")}
                disabled={statusActionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {statusActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {statusActionTarget.status === "disabled" ? "Approve" : "Disable"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Enrollment Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Fingerprint">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Remove fingerprint enrollment for <span className="font-semibold text-foreground">{deleteTarget.user_name}</span> ({deleteTarget.user_id}) on device{' '}
              <span className="font-mono text-xs">{deleteTarget.device_id}</span>?
            </p>
            <p className="text-xs text-muted-foreground/60">
              The fingerprint will be removed from both the server and the physical sensor.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-40"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Enrollment Wizard Modal */}
      <Modal
        open={showWizard}
        onClose={() => setShowWizard(false)}
        title="Enroll Fingerprint"
        className="max-w-xl"
      >
        <FingerprintEnrollmentWizard
          userId={wizardUserId}
          userName={wizardUserName}
          devices={approvedDevices}
          defaultDeviceId={wizardDeviceId || undefined}
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      </Modal>
    </div>
  )
}
