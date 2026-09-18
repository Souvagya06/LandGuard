import type {
  AlertRecord, DeviceList, FieldReport, LocationAnalysis, MonitoringSummary, MonitoringZone, MonitoringZonesResponse,
  PredictionResponse, PublicAlert, RiskLevel, SessionUser, SimulationParams, SystemStatus, Zone,
} from '../types'
import { API_BASE } from './config'

export { API_BASE }

// ─────────────────────────────────────────────────────────────
// Session — the bearer token lives only for this browser tab.
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'landguard.session'

export interface Session {
  token: string
  expiresAt: string
  user: SessionUser
}

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (Date.parse(session.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable: the session lasts for this page view only */
  }
  window.dispatchEvent(new Event('landguard:session'))
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const session = readSession()
  if (init.auth !== false && session) headers.Authorization = `Bearer ${session.token}`
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method || 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(0, 'LandGuard API is unreachable. Check the connection.')
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    if (res.status === 401 && session) writeSession(null)
    throw new ApiError(res.status, data?.detail || `Request failed (${res.status})`)
  }
  return data as T
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export const fetchAuthConfig = () => request<{ authRequired: boolean }>('/auth/config', { auth: false })

export async function signIn(username: string, password: string): Promise<Session> {
  const session = await request<Session>('/auth/login', { method: 'POST', body: { username, password }, auth: false })
  writeSession(session)
  return session
}

export function signOut() {
  writeSession(null)
}

export const fetchSession = () => request<{ user: SessionUser; development: boolean; expiresAt: string | null }>('/auth/session')

// ─────────────────────────────────────────────────────────────
// Monitoring — same backend source as the Android app
// ─────────────────────────────────────────────────────────────

export const fetchMonitoringZones = () => request<MonitoringZonesResponse>('/monitoring/zones')
export const fetchMonitoringSummary = () => request<MonitoringSummary>('/monitoring/summary')
export const fetchMonitoringZone = (id: string) => request<MonitoringZone>(`/monitoring/zones/${encodeURIComponent(id)}`)
export const fetchAnalysis = (lat: number, lng: number) =>
  request<LocationAnalysis>(`/monitoring/analysis?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`)
export const refreshMonitoring = () => request<MonitoringSummary>('/monitoring/refresh', { method: 'POST', body: {} })

// ─────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────

export const fetchAuthorityAlerts = () => request<AlertRecord[]>('/alerts?view=authority&limit=300')
export const fetchPublicAlert = (id: string) => request<PublicAlert>(`/alerts/${encodeURIComponent(id)}`)

export interface CreateAlertInput {
  zoneId: string
  level: RiskLevel
  message: string
  expiresInMinutes: number
  clientRequestId: string
}

export const createAlert = (input: CreateAlertInput) =>
  request<AlertRecord>('/alerts', { method: 'POST', body: { ...input, origin: 'authority_web', channel: 'push' } })
export const approveAlert = (id: string) => request<AlertRecord>(`/alerts/${encodeURIComponent(id)}/approve`, { method: 'POST' })
export const cancelAlert = (id: string) => request<AlertRecord>(`/alerts/${encodeURIComponent(id)}/cancel`, { method: 'POST' })

// ─────────────────────────────────────────────────────────────
// System & devices
// ─────────────────────────────────────────────────────────────

export const fetchSystemStatus = () => request<SystemStatus>('/system/status')
export const fetchDevices = () => request<DeviceList>('/devices')
export const fetchHealth = () => request<{ status: string; version: string; time: string }>('/health', { auth: false })

// ─────────────────────────────────────────────────────────────
// Field reports
// ─────────────────────────────────────────────────────────────

export const fetchReports = () => request<FieldReport[]>('/reports')

export const submitReport = (payload: { zoneId: string; zoneName: string; note: string; photoDataUrl?: string; lat: number; lng: number }) =>
  request<{ ok: boolean; report: FieldReport }>('/reports', { method: 'POST', body: payload })

export const verifyReport = (id: string, verdict: 'verified' | 'rejected', note = '') =>
  request<FieldReport>(`/reports/${encodeURIComponent(id)}/verify`, { method: 'POST', body: { verdict, note } })

export const deleteReport = (id: string) =>
  request<{ ok: boolean; report: FieldReport }>(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ─────────────────────────────────────────────────────────────
// Model zones & What-If simulation
// ─────────────────────────────────────────────────────────────

export const fetchZones = () => request<Zone[]>('/zones')
export const predictRisk = (params: SimulationParams) => request<PredictionResponse>('/predict', { method: 'POST', body: params })
