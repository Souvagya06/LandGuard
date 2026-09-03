import type { RiskFactor } from '../types'

export default function RiskBreakdown({ factors }: { factors: RiskFactor[] }) {
  const total = factors.reduce((sum, f) => sum + f.value, 0) || 1

  return (
    <div className="space-y-3">
      {factors.map((f) => {
        const pct = Math.round((f.value / total) * 100)
        return (
          <div key={f.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-neutral-600">{f.label}</span>
              <span className="font-medium text-neutral-800">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-800"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
