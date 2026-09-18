export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

// ─────────────────────────────────────────────────────────────
// Regional monitoring (shared with the Android app)
// ─────────────────────────────────────────────────────────────

export interface RiskFactorScore {
  name: string
  score: number
  weight: number
  detail: string
}

export interface RiskIndex {
  score: number
  level: RiskLevel
  severity: Uppercase<RiskLevel>
  factors: RiskFactorScore[]
  /** Share of model weight backed by real data (0..1). */
  coverage: number
}

export interface RainfallReading {
  past72hMm: number
  next24hMm: number
  soilMoistureM3M3: number | null
  source: string
  fetchedAtMillis: number
  observedAt: string
}

export interface TerrainReading {
  elevationM: number
  slopeDeg: number
  source: string
}

export interface LandslideEvent {
  id: string
  title: string
  dateMillis: number | null
  latitude: number
  longitude: number
  state: string
  nearestPlace: string | null
  locationDescription: string | null
  category: string | null
  trigger: string | null
  size: string | null
  fatalities: number
  injuries: number
  sourceName: string | null
  sourceLink: string | null
}

export interface MonitoringZone {
  id: string
  name: string
  state: string
  lat: number
  lng: number
  eventCount: number
  fatalities: number
  firstEventAt: string | null
  lastEventAt: string | null
  dominantTrigger: string | null
  risk: RiskIndex
  rainfall: RainfallReading | null
  terrain: TerrainReading | null
  events?: LandslideEvent[]
}

export type ConditionsState = 'live' | 'stale' | 'unavailable'

export interface ConditionsSummary {
  state: ConditionsState
  observedAt: string | null
  lastAttemptAt: string | null
  refreshMinutes: number
  error: string | null
  rainfallSource: string
  terrainSource: string
  zonesWithRainfall: number
  zonesWithTerrain: number
}

export interface CatalogSummary {
  events: number
  fetchedAt: string | null
  fromCache: boolean
  source: string
  error: string | null
}

export interface MonitoringZonesResponse {
  generatedAt: string
  conditions: ConditionsSummary
  catalog: CatalogSummary
  zones: MonitoringZone[]
}

export interface MonitoringSummary {
  region: { name: string; states: string[]; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }
  zones: number
  byLevel: Record<RiskLevel, number>
  catalog: CatalogSummary
  conditions: ConditionsSummary
  satellite: { sentinel2: string; sentinel1: string; alos4: string }
  generatedAt: string
}

export type Maybe<T> = { available: true; value: T } | { available: false; reason: string }

export interface OpticalReading {
  sceneId: string
  acquiredMillis: number
  clearFraction: number
  ndvi: number
  ndviChange: number | null
  baseline: { sceneId: string; acquiredMillis: number; ndvi: number } | null
  source: string
}

export interface SarReading {
  sceneId: string
  acquiredMillis: number
  vvDb: number
  baselineVvDb: number | null
  baselineAcquiredMillis: number | null
  vvChangeDb: number | null
  source: string
}

export interface LocationAnalysis {
  latitude: number
  longitude: number
  analysedAt: string
  optical: Maybe<OpticalReading>
  sar: Maybe<SarReading>
  alos4: Maybe<never>
  rainfall: Maybe<Omit<RainfallReading, 'observedAt'>>
  terrain: Maybe<TerrainReading>
  history: Maybe<{ eventsWithin10Km: number; fatalitiesWithin10Km: number; nearestEventKm: number | null; lastEventMillis: number | null }>
  risk: Maybe<RiskIndex>
}

// ─────────────────────────────────────────────────────────────
// Alerts — the one LandGuard alert structure (backend/alert-contract.js)
// ─────────────────────────────────────────────────────────────

export type AlertStatus = 'awaiting_approval' | 'active' | 'cancelled' | 'expired'

export interface PublicAlert {
  schemaVersion: number
  alertId: string
  id: string
  zoneId: string
  zoneName: string
  level: RiskLevel
  severity: Uppercase<RiskLevel>
  message: string
  timestamp: string
  expiresAt: string
  source: 'authority' | 'risk_engine'
  status: AlertStatus
  origin: 'authority_web' | 'api'
  hopCount: number
  lat: number | null
  lng: number | null
  updatedAt: string
}

export interface ActorRef {
  id: string
  name: string
  role: string
}

export interface FcmDelivery {
  status: 'sent' | 'partially_sent' | 'not_sent'
  reason?: string
  attempted: number
  accepted: number
  failed: number
  invalidTokensRemoved: number
  failures: Record<string, number>
}

export interface AlertRecord extends PublicAlert {
  channel?: string
  createdAt: string
  createdBy: ActorRef | null
  approvedAt: string | null
  approvedBy: ActorRef | null
  dispatchedAt: string | null
  cancelledAt: string | null
  cancelledBy: ActorRef | null
  riskSnapshot: { score: number; level: RiskLevel; coverage?: number; conditionsObservedAt?: string | null } | null
  delivery: { status: 'pending' | FcmDelivery['status']; attemptedAt: string | null; fcm: FcmDelivery | null }
  receipts: {
    devices: number
    received: number
    opened: number
    acknowledged: number
    via: Partial<Record<'fcm' | 'sync' | 'mesh', number>>
    maxHopCount: number
    lastReceiptAt: string | null
  }
}

// ─────────────────────────────────────────────────────────────
// System, devices, auth
// ─────────────────────────────────────────────────────────────

export interface SystemStatus {
  status: string
  version: string
  time: string
  push: { configured: boolean; reason?: string }
  realtime: { connectedClients: number }
  devices: { registered: number; android: number; activeLast7Days: number; lastRegistrationAt: string | null }
  alerts: { active: number; awaitingApproval: number; total: number }
  monitoring: MonitoringSummary
  riskBands: { level: RiskLevel; min: number; max: number }[]
  security: { authenticationRequired: boolean }
}

export interface DeviceList {
  registeredDevices: number
  androidDevices: number
  activeLast7Days: number
  devices: { id: string; platform: string; appVersion: string | null; registeredAt: string; lastSeenAt: string; zoneSubscriptions: number }[]
}

export interface SessionUser {
  username: string
  name: string
  role: 'viewer' | 'field_officer' | 'operator' | 'incident_commander' | 'admin'
}

// ─────────────────────────────────────────────────────────────
// Field reports & legacy model zones (What-If Studio)
// ─────────────────────────────────────────────────────────────

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

/** Minimal zone shape used by report forms. */
export interface ZoneRef {
  id: string
  name: string
  lat: number
  lng: number
}

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
  rainfall24h: number
  rainfall7d: number
  roadStatus: 'open' | 'restricted' | 'blocked'
  factors: RiskFactor[]
  explanation?: string
  updatedAt: string
  modelSource?: 'trained_python' | 'portable_heuristic'
  modelVersion?: string
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
