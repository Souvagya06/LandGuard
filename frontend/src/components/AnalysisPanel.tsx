import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Zone } from '../types'
import { mapColor } from '../lib/risk'

interface Props {
  zones: Zone[]
  selectedZone?: Zone
}

const chartTheme = {
  grid: '#26302d',
  axis: '#93a19a',
  tooltipBackground: '#171d1b',
  tooltipBorder: '#3a453f',
}

export default function AnalysisPanel({ zones, selectedZone }: Props) {
  const riskData = zones.map((zone) => ({
    name: zone.name.replace(' ', '\n'),
    risk: zone.riskScore,
    color: mapColor(zone.riskLevel),
  }))

  const rainfallData = zones.map((zone) => ({
    name: zone.name.replace(' ', '\n'),
    '24h': zone.rainfall24h,
    '7 day': zone.rainfall7d,
  }))

  const factorData = selectedZone?.factors.map((factor) => ({
    name: factor.label,
    value: factor.value,
  })) ?? []

  return (
    <section id="analysis" className="scroll-mt-6 border-t border-[#26302d] pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#57b79e]">Pattern analysis</p>
          <h2 className="text-xl font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Zone intelligence
          </h2>
        </div>
        <p className="text-xs text-[#5c6a64]">Updated with the latest zone readings</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Risk score by zone" subtitle="Current probability score, 0-100">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="name" stroke={chartTheme.axis} tick={{ fontSize: 10 }} interval={0} />
              <YAxis domain={[0, 100]} stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
              <Bar dataKey="risk" name="Risk" radius={[3, 3, 0, 0]}>
                {riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rainfall load" subtitle="Accumulated rainfall by monitored zone">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rainfallData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="name" stroke={chartTheme.axis} tick={{ fontSize: 10 }} interval={0} />
              <YAxis stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="mm" />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.axis }} />
              <Bar dataKey="24h" fill="#57b79e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="7 day" fill="#6f97c9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`${selectedZone?.name ?? 'Selected zone'} risk factors`}
          subtitle="Relative contribution to the current score"
        >
          {factorData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={factorData} layout="vertical" margin={{ top: 8, right: 18, left: 24, bottom: 8 }}>
                <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
                <XAxis type="number" stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={116} stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
                <Bar dataKey="value" name="Contribution" fill="#e0913f" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#5c6a64]">Select a zone to inspect its factors</div>
          )}
        </ChartCard>
      </div>
    </section>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#26302d] bg-[#121716] p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#eef2ef]">{title}</h3>
        <p className="text-[11px] text-[#5c6a64]">{subtitle}</p>
      </div>
      <div className="h-64">{children}</div>
    </div>
  )
}

function ChartTooltip({ active, payload, label, suffix = '' }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded border border-[#3a453f] bg-[#171d1b] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-[#93a19a]">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[#eef2ef]">
          {entry.name}: {entry.value}{suffix}
        </p>
      ))}
    </div>
  )
}
