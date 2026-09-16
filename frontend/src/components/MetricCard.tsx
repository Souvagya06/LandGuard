import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  trend?: string
  trendColor?: 'emerald' | 'amber' | 'red' | 'cyan'
  dominant?: boolean
}

export default function MetricCard({ label, value, hint, icon, trend, trendColor = 'emerald', dominant = false }: Props) {
  const trendColorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  }

  return (
    <div className={`glass-panel w-full rounded-xl border flex min-h-[170px] flex-col justify-between transition-all group ${dominant ? 'border-red-500/40 bg-red-950/15 p-5 shadow-[inset_3px_0_0_#ef4444]' : 'border-[#1f2b27] p-3 hover:border-[#2c3e38]'}`}>
      <div className="flex items-center justify-between">
        <p className={`${dominant ? 'text-sm font-semibold text-[#e6f0eb]' : 'text-[11px] font-medium text-[#9bb0a6]'}`}>{label}</p>
        {icon && <div className="text-[#596b63] group-hover:text-emerald-400 transition-colors">{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className={`font-mono font-bold tracking-tight text-[#f0f5f2] transition-all duration-300 ${dominant ? 'text-4xl' : 'text-xl'}`}>
          {value}
        </p>
        {trend && (
          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold border ${trendColorClasses[trendColor]}`}>
            {trend}
          </span>
        )}
      </div>

      {hint && <p className="mt-1 text-[11px] text-[#9bb0a6]">{hint}</p>}
    </div>
  )
}
