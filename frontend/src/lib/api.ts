import type { Zone, AlertItem, WhatsAppAlertResult } from '../types'

// Configure VITE_API_URL to use the FastAPI service in production.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

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

export async function sendWhatsAppAlert(payload: {
  zoneId: string
  recipientPhone: string
  message: string
}): Promise<WhatsAppAlertResult> {
  const res = await fetch(`${API_BASE}/alerts/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail ?? 'Failed to prepare WhatsApp alert')
  }
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
