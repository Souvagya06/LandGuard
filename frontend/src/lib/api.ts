import type { Zone, AlertItem, FieldReport, BackendHealth, DeviceStats, SimulationParams, PredictionResponse } from '../types'
import { mockAlerts } from '../data/mockZones'

// Configure VITE_API_URL to use the FastAPI / Express service in production.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export async function fetchZones(): Promise<Zone[]> {
  const res = await fetch(`${API_BASE}/zones`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Live zone telemetry is unavailable')
  }
  const data = await res.json()
  if (!Array.isArray(data) || !data.length) throw new Error('No live zones were returned')
  return data
}

export async function fetchZone(id: string): Promise<Zone | undefined> {
  const res = await fetch(`${API_BASE}/zones/${id}`)
  if (!res.ok) throw new Error('Failed to fetch zone')
  return res.json()
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  try {
    const res = await fetch(`${API_BASE}/alerts`)
    if (!res.ok) throw new Error('Failed to fetch alerts')
    const data = await res.json()
    return Array.isArray(data) ? data : mockAlerts
  } catch {
    return mockAlerts
  }
}

export async function triggerAlert(payload: {
  zoneId: string
  level?: 'low' | 'moderate' | 'high' | 'critical' | 'casual'
  message?: string
  channel?: 'push' | 'sms' | 'dashboard' | 'popup' | 'app' | 'sms-app'
}): Promise<AlertItem> {
  const res = await fetch(`${API_BASE}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Failed to dispatch alert')
  }
  return res.json()
}

export async function fetchReports(): Promise<FieldReport[]> {
  try {
    const res = await fetch(`${API_BASE}/reports`)
    if (!res.ok) throw new Error('Failed to fetch field reports')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('[API] Failed to fetch field reports:', err)
    return []
  }
}

export async function submitReport(payload: {
  zoneId: string
  zoneName: string
  note: string
  photoDataUrl?: string
  lat: number
  lng: number
}): Promise<{ ok: boolean; report: FieldReport }> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Failed to submit report')
  }
  return res.json()
}

export async function fetchHealth(): Promise<BackendHealth> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error('Backend health check failed')
  return res.json()
}

export async function fetchDevices(): Promise<DeviceStats> {
  try {
    const res = await fetch(`${API_BASE}/devices`)
    if (!res.ok) throw new Error('Failed to fetch device stats')
    return res.json()
  } catch {
    return { registeredDevices: 0, androidDevices: 0 }
  }
}

export async function predictRisk(params: SimulationParams): Promise<PredictionResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'ML prediction inference failed')
  }
  return res.json()
}
