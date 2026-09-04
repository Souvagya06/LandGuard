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
  rainfall24h: number
  rainfall7d: number
  roadStatus: 'open' | 'restricted' | 'blocked'
  factors: RiskFactor[]
  updatedAt: string
}

export interface AlertItem {
  id: string
  zoneId: string
  zoneName: string
  level: RiskLevel
  message: string
  channel: 'push' | 'sms' | 'dashboard'
  createdAt: string
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
