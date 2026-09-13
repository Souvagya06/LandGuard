import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  trend?: string
  trendColor?: 'emerald' | 'amber' | 'red' | 'cyan'
}

export default function MetricCard({ label, value, hint, icon, trend, trendColor = 'emerald' }: Props) {
  const trendColorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  }

  return (
    <div className="glass-panel rounded-xl p-4 border border-[#1f2b27] flex flex-col justify-between hover:border-[#2c3e38] transition-all group">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#9bb0a6]">{label}</p>
        {icon && <div className="text-[#596b63] group-hover:text-emerald-400 transition-colors">{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="font-mono text-2xl font-bold tracking-tight text-[#f0f5f2]">
          {value}
        </p>
        {trend && (
          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold border ${trendColorClasses[trendColor]}`}>
            {trend}
          </span>
        )}
      </div>

      {hint && <p className="mt-1 text-[11px] text-[#596b63] font-mono">{hint}</p>}
    </div>
  )
}