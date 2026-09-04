import type { Zone, AlertItem } from '../types'
import { mockZones, mockAlerts } from '../data/mockZones'

// Configure VITE_API_URL to use the FastAPI / Express service in production.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export async function fetchZones(): Promise<Zone[]> {
  try {
    const res = await fetch(`${API_BASE}/zones`)
    if (!res.ok) throw new Error('Failed to fetch zones')
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data : mockZones
  } catch {
    return mockZones
  }
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
