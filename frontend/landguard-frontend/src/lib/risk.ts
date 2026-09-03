import type { RiskLevel } from '../types'

export const riskMeta: Record<RiskLevel, { label: string; bg: string; text: string; dot: string }> = {
  low: { label: 'Low', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  moderate: { label: 'Moderate', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  high: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-600' },
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 30) return 'moderate'
  return 'low'
}

export function mapColor(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return '#dc2626'
    case 'high':
      return '#ea580c'
    case 'moderate':
      return '#f59e0b'
    default:
      return '#10b981'
  }
}
