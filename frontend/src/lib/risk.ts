import type { RiskLevel } from '../types'

/**
 * Risk terminology and colours — identical to the Android app
 * (Severity enum + MapFirstComponents.accent/container/label and
 * RiskEngineService.categorizeScore thresholds 25 / 50 / 75).
 */
export const RISK_LEVELS: RiskLevel[] = ['critical', 'high', 'moderate', 'low']

export const riskMeta: Record<RiskLevel, { label: string; accent: string; container: string; range: string }> = {
  critical: { label: 'Critical', accent: '#DC2626', container: '#FEF2F2', range: '75–100' },
  high: { label: 'High', accent: '#EA580C', container: '#FFF7ED', range: '50–74' },
  moderate: { label: 'Moderate', accent: '#D97706', container: '#FFFBEB', range: '25–49' },
  low: { label: 'Low', accent: '#16A34A', container: '#F0FDF4', range: '0–24' },
}

export const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, critical: 3 }

export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'moderate'
  return 'low'
}

export const mapColor = (level: RiskLevel) => riskMeta[level].accent
