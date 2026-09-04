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

export interface PredictPayload {
  lat: number
  lng: number
  elevation_m?: number
  slope_deg?: number
  aspect_deg?: number
  ndvi?: number
  sar_disturbance?: number
  rain_1d?: number
  rain_3d_sum?: number
  rain_7d_sum?: number
  roadStatus?: 'open' | 'restricted' | 'blocked'
}

export interface PredictResult {
  lat: number
  lng: number
  susceptibility_score: number
  trigger_probability: number
  risk_score: number
  risk_level: RiskLevel
  rainfall24h: number
  rainfall7d: number
  factors: RiskFactor[]
  explanation: string
  simulated: boolean
  timestamp: string
}
