import type { Zone, AlertItem, PredictPayload, PredictResult } from '../types'

// Configure VITE_API_URL to use the Node.js service (default port 8000)
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export async function fetchHealth(): Promise<{ status: string; runtime: string; mlEngine: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error('Health check failed')
  return res.json()
}

export async function fetchZones(): Promise<Zone[]> {
  const res = await fetch(`${API_BASE}/zones`)
  if (!res.ok) throw new Error('Failed to fetch zones')
  return res.json()
}

export async function fetchZone(id: string): Promise<Zone | undefined> {
  const res = await fetch(`${API_BASE}/zones/${id}`)
  if (!res.ok) throw new Error('Failed to fetch zone')
  return res.json()
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  const res = await fetch(`${API_BASE}/alerts`)
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}

export async function triggerAlert(zone: Zone): Promise<AlertItem> {
  const res = await fetch(`${API_BASE}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zoneId: zone.id }),
  })
  if (!res.ok) throw new Error('Failed to trigger alert')
  return res.json()
}

export async function submitReport(payload: {
  zoneId: string
  zoneName: string
  note: string
  photoDataUrl?: string
  lat: number
  lng: number
}) {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to submit report')
  return res.json()
}

export async function predictCustomRisk(payload: PredictPayload): Promise<PredictResult> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to run ML prediction')
  return res.json()
}
