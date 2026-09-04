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
  Line,
  ComposedChart,
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

function getShortName(fullName: string) {
  const primary = fullName.split('—')[0].trim()
  return primary.length > 15 ? primary.slice(0, 13) + '…' : primary
}

export default function AnalysisPanel({ zones, selectedZone }: Props) {
  const riskData = zones.map((zone) => ({
    name: getShortName(zone.name),
    fullName: zone.name,
    district: zone.district,
    risk: zone.riskScore,
    color: mapColor(zone.riskLevel),
  }))

  const rainfallData = zones.map((zone) => ({
    name: getShortName(zone.name),
    fullName: zone.name,
    district: zone.district,
    '24h Rain': zone.rainfall24h,
    '7d Rain': zone.rainfall7d,
  }))

  const landslidePredictionData = zones.map((zone) => {
    const triggerPct = Math.round((zone.triggerProbability ?? 0.5) * 100)
    const deformPct = Math.round((zone.groundDeformation ?? 0.4) * 100)
    const predRate = zone.landslideRate ?? Math.round(triggerPct * 0.7 + deformPct * 0.3)
    return {
      name: getShortName(zone.name),
      fullName: zone.name,
      district: zone.district,
      'Landslide Rate %': predRate,
      'Live Rain Trigger %': triggerPct,
      'InSAR Deform %': deformPct,
    }
  })

  const factorData = selectedZone?.factors.map((factor) => ({
    name: factor.label,
    value: factor.value,
  })) ?? []

  return (
    <section id="analysis" className="scroll-mt-6 border-t border-[#26302d] pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#57b79e]">Dynamic ML Analytics</p>
          <h2 className="text-xl font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Zone intelligence & Predictive Charts
          </h2>
        </div>
        <p className="text-xs text-[#5c6a64]">Live weather, 7-day accumulation & satellite InSAR deformation</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Chart 1: Risk score by zone with tilted X-axis labels */}
        <ChartCard title="Risk Score by Monitored Settlement" subtitle="Dual-Agent combined susceptibility and trigger score (0-100)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskData} margin={{ top: 8, right: 12, left: -16, bottom: 40 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis
                dataKey="name"
                stroke={chartTheme.axis}
                tick={{ fontSize: 10, fill: '#93a19a' }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis domain={[0, 100]} stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
              <Bar dataKey="risk" name="Risk Score" radius={[3, 3, 0, 0]}>
                {riskData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Rainfall load with tilted X-axis labels */}
        <ChartCard title="Rainfall Rate & Load" subtitle="Live 24h precipitation vs 7-day cumulative load (mm)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rainfallData} margin={{ top: 8, right: 12, left: -16, bottom: 40 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis
                dataKey="name"
                stroke={chartTheme.axis}
                tick={{ fontSize: 10, fill: '#93a19a' }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="mm" />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.axis, paddingTop: '2px' }} />
              <Bar dataKey="24h Rain" fill="#57b79e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="7d Rain" fill="#6f97c9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Landslide Prediction Graph beside/paired with Rainfall */}
        <ChartCard
          title="Landslide Prediction & Hazard Rate Graph"
          subtitle="Dynamic prediction rate driven by live rainfall, 7d saturation & InSAR ground deformation"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={landslidePredictionData} margin={{ top: 8, right: 12, left: -16, bottom: 40 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis
                dataKey="name"
                stroke={chartTheme.axis}
                tick={{ fontSize: 10, fill: '#93a19a' }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis domain={[0, 100]} stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.axis, paddingTop: '2px' }} />
              <Bar dataKey="Landslide Rate %" fill="#d9663f" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Live Rain Trigger %" stroke="#57b79e" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="InSAR Deform %" stroke="#e0913f" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Selected Settlement Risk Factors */}
        <ChartCard
          title={`${selectedZone?.name ?? 'Selected Settlement'} Feature Contributions`}
          subtitle="Dynamic trigger & geomorphic weights driving current risk level"
        >
          {factorData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={factorData} layout="vertical" margin={{ top: 8, right: 18, left: 24, bottom: 8 }}>
                <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={120} stroke={chartTheme.axis} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: '#26302d', opacity: 0.35 }} />
                <Bar dataKey="value" name="Contribution" fill="#e0913f" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#5c6a64]">Select a settlement on the map to inspect its SHAP breakdown</div>
          )}
        </ChartCard>
      </div>
    </section>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#26302d] bg-[#121716] p-4 flex flex-col justify-between">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#eef2ef]">{title}</h3>
        <p className="text-[11px] text-[#5c6a64]">{subtitle}</p>
      </div>
      <div className="h-64">{children}</div>
    </div>
  )
}

function ChartTooltip({ active, payload, suffix = '' }: { active?: boolean; payload?: Array<{ name: string; value: number; payload?: { fullName?: string; district?: string } }>; suffix?: string }) {
  if (!active || !payload?.length) return null

  const first = payload[0]?.payload
  const title = first?.fullName || first?.district || ''

  return (
    <div className="rounded border border-[#3a453f] bg-[#171d1b] px-3 py-2 text-xs shadow-lg max-w-xs z-50">
      {title && <p className="mb-1 font-medium text-[#57b79e] border-b border-[#26302d] pb-1">{title}</p>}
      <div className="space-y-0.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex justify-between gap-3 text-[#eef2ef]">
            <span className="text-[#93a19a]">{entry.name}:</span>
            <span className="font-mono font-medium">{entry.value}{suffix}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

