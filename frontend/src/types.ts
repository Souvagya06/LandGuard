export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

export interface RiskFactor {
  label: string
  value: number
}

export interface Zone {
  id: string
  name: string
  district: string
  lat: number
  lng: number
  riskScore: number
  riskLevel: RiskLevel
  susceptibilityScore?: number
  triggerProbability?: number
  landslideProbability?: number
  landslideRate?: number
  groundDeformation?: number
  deformationRateMm?: number
  rainfall24h: number
  rainfall7d: number
  roadStatus: 'open' | 'restricted' | 'blocked'
  factors: RiskFactor[]
  explanation?: string
  updatedAt: string
}

export interface AlertItem {
  id: string
  zoneId: string
  zoneName: string
  level: RiskLevel
  message: string
  channel: 'push' | 'sms' | 'dashboard' | 'popup' | 'app' | 'sms-app'
  createdAt: string
  delivery?: {
    status: 'pending' | 'sent' | 'partially_sent' | 'not_sent'
    attemptedAt: string | null
    fcm?: { attempted: number; delivered: number; failed: number; reason?: string }
  }
}

export interface FieldReport {
  id: string
  zoneId: string
  zoneName: string
  note: string
  photoDataUrl?: string
  lat: number
  lng: number
  status: 'pending_sync' | 'synced' | 'verified'
  createdAt: string
}
