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
  modelSource?: 'trained_python' | 'portable_heuristic'
  modelVersion?: string
}

export interface AlertItem {
  id: string
  zoneId: string
  zoneName: string
  level: RiskLevel
  message: string
  channel: 'push' | 'sms' | 'dashboard' | 'popup' | 'app' | 'sms-app'
  createdAt: string
  status?: 'awaiting_approval' | 'approved' | 'dispatched'
  approvedAt?: string
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
  status: 'pending_sync' | 'pending_review' | 'synced' | 'verified' | 'rejected'
  createdAt: string
}

export interface BackendHealth {
  status: string
  runtime: string
  mlEngine: string
  monitoringLocations: number
  spatialFeatureSource: string
  version: string
}

export interface DeviceStats {
  registeredDevices: number
  androidDevices: number
}

export interface SimulationParams {
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
  rain_14d_sum?: number
  rain_30d_sum?: number
  rain_max_7d?: number
  api_7d?: number
  roadStatus?: 'open' | 'restricted' | 'blocked'
}

export interface PredictionResponse {
  lat: number
  lng: number
  risk_score: number
  risk_level: RiskLevel
  susceptibility_score: number
  trigger_probability: number
  rainfall24h: number
  rainfall7d: number
  factors: RiskFactor[]
  explanation: string
  simulated: boolean
  timestamp: string
}

export interface WebSocketAlertMessage {
  type: 'alert' | 'connection' | 'pong'
  message?: string
  data?: AlertItem
  clientId?: string
  timestamp: string
}
