import type { RiskLevel } from '../types'

export const riskMeta: Record<RiskLevel, { label: string; bg: string; text: string; dot: string; range: string }> = {
  low: { label: 'Low (<25%)', bg: 'bg-emerald-500/15', text: 'text-emerald-400 border border-emerald-500/30', dot: 'bg-emerald-500', range: '<25%' },
  moderate: { label: 'Moderate (25–50%)', bg: 'bg-amber-500/15', text: 'text-amber-400 border border-amber-500/30', dot: 'bg-amber-500', range: '25–50%' },
  high: { label: 'High (50–75%)', bg: 'bg-orange-500/15', text: 'text-orange-400 border border-orange-500/30', dot: 'bg-orange-500', range: '50–75%' },
  critical: { label: 'Critical (75–100%)', bg: 'bg-red-500/15', text: 'text-red-400 border border-red-500/30', dot: 'bg-red-600', range: '75–100%' },
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'moderate'
  return 'low'
}

export function mapColor(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return '#dc2626' // Red
    case 'high':
      return '#ea580c' // Orange
    case 'moderate':
      return '#f59e0b' // Yellow / Amber
    default:
      return '#10b981' // Green
  }
}
