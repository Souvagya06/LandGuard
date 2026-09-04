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
              <span className="text-[#93a19a]">{f.label}</span>
              <span className="font-medium text-[#eef2ef]">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1c2422]">
              <div
                className="h-full rounded-full bg-[#57b79e]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}