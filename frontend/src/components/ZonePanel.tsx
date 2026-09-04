import type { Zone } from '../types'
import { riskMeta } from '../lib/risk'
import RiskBreakdown from './RiskBreakdown'

interface Props {
  zone?: Zone
  onTriggerAlert: (zone: Zone) => void
  sending: boolean
}

const roadLabel: Record<Zone['roadStatus'], string> = {
  open: 'Open',
  restricted: 'Restricted',
  blocked: 'Blocked',
}

export default function ZonePanel({ zone, onTriggerAlert, sending }: Props) {
  if (!zone) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-[#26302d] bg-[#121716] p-6 text-sm text-[#5c6a64]">
        Select a zone on the map to see its risk breakdown
      </div>
    )
  }

  const meta = riskMeta[zone.riskLevel]
  const canAlert = zone.riskLevel === 'high' || zone.riskLevel === 'critical'
  const suscPercent = Math.round((zone.susceptibilityScore ?? 0.4) * 100)
  const triggerPercent = Math.round((zone.triggerProbability ?? 0.5) * 100)

  return (
    <div className="rounded-lg border border-[#26302d] bg-[#121716] p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {zone.name}
          </p>
          <p className="text-xs text-[#93a19a]">{zone.district}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.text}`}>
          {meta.label} · {zone.riskScore}%
        </span>
      </div>

      {/* Dual-Agent AI Models Output */}
      <div className="rounded-md border border-[#26302d] bg-[#171d1b] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-[#93a19a]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#57b79e]">Dual-Agent ML Engine</span>
          <span className="text-[10px] text-[#5c6a64]">HistGradientBoosting</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center pt-1">
          <div className="rounded bg-[#121716] p-2 border border-[#26302d]">
            <p className="text-[10px] text-[#93a19a]">Agent A (Terrain Susc.)</p>
            <p className="text-sm font-semibold text-[#57b79e]">{suscPercent}%</p>
          </div>
          <div className="rounded bg-[#121716] p-2 border border-[#26302d]">
            <p className="text-[10px] text-[#93a19a]">Agent B (Rain Trigger)</p>
            <p className="text-sm font-semibold text-[#e0913f]">{triggerPercent}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-[#171d1b] p-2">
          <p className="text-[11px] text-[#93a19a]">Rain 24h</p>
          <p className="text-sm font-medium text-[#eef2ef]">{zone.rainfall24h}mm</p>
        </div>
        <div className="rounded-md bg-[#171d1b] p-2">
          <p className="text-[11px] text-[#93a19a]">Rain 7d</p>
          <p className="text-sm font-medium text-[#eef2ef]">{zone.rainfall7d}mm</p>
        </div>
        <div className="rounded-md bg-[#171d1b] p-2">
          <p className="text-[11px] text-[#93a19a]">Road</p>
          <p className="text-sm font-medium text-[#eef2ef]">{roadLabel[zone.roadStatus]}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[#93a19a]">SHAP Feature Contribution</p>
        <RiskBreakdown factors={zone.factors} />
      </div>

      {/* Live Landslide Probability Rate (Live Rain + 7d Rain + InSAR Ground Deformation) */}
      <div className="rounded-md border border-[#26302d] bg-[#141a18] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#57b79e]">Dynamic Prediction Engine</p>
            <h4 className="text-xs font-semibold text-[#eef2ef]">Live Landslide Probability Rate</h4>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            (zone.landslideRate ?? triggerPercent) >= 70 ? 'bg-[#d9663f]/20 text-[#e28e6c] border border-[#d9663f]/40' :
            (zone.landslideRate ?? triggerPercent) >= 40 ? 'bg-[#e0913f]/20 text-[#e0913f] border border-[#e0913f]/40' :
            'bg-[#57b79e]/20 text-[#57b79e] border border-[#57b79e]/40'
          }`}>
            {zone.landslideRate ?? triggerPercent}% Rate
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-[#1c2422] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (zone.landslideRate ?? triggerPercent) >= 70 ? 'bg-gradient-to-r from-[#e0913f] to-[#d9663f]' :
                (zone.landslideRate ?? triggerPercent) >= 40 ? 'bg-gradient-to-r from-[#57b79e] to-[#e0913f]' :
                'bg-gradient-to-r from-[#398472] to-[#57b79e]'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, zone.landslideRate ?? triggerPercent))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#5c6a64] font-mono">
            <span>Low Risk (0%)</span>
            <span>Moderate (50%)</span>
            <span>Critical (100%)</span>
          </div>
        </div>

        {/* 3 Key Dynamic Telemetry Factors */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded border border-[#26302d] bg-[#171d1b] p-2 text-center">
            <p className="text-[10px] text-[#93a19a]">Live 24h Rain</p>
            <p className="text-xs font-semibold text-[#57b79e]">{zone.rainfall24h} mm</p>
          </div>
          <div className="rounded border border-[#26302d] bg-[#171d1b] p-2 text-center">
            <p className="text-[10px] text-[#93a19a]">7-Day Rain</p>
            <p className="text-xs font-semibold text-[#6f97c9]">{zone.rainfall7d} mm</p>
          </div>
          <div className="rounded border border-[#26302d] bg-[#171d1b] p-2 text-center">
            <p className="text-[10px] text-[#93a19a]">Ground Deform</p>
            <p className="text-xs font-semibold text-[#e0913f]">
              {zone.deformationRateMm ?? ((zone.groundDeformation ?? 0.4) * 32).toFixed(1)} <span className="text-[9px] font-normal text-[#93a19a]">mm/y</span>
            </p>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-[#7e8d86]">
          Real-time rate synthesized from live precipitation intensity, antecedent moisture saturation, and Sentinel-1 InSAR surface deformation.
        </p>
      </div>

      {zone.explanation && (
        <div className="rounded-md border border-[#26302d] bg-[#171d1b]/60 p-3 text-xs leading-relaxed text-[#c4d1cb]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#57b79e] mb-1">AI Operational Advisory</p>
          {zone.explanation}
        </div>
      )}

      {canAlert && (
        <button
          onClick={() => onTriggerAlert(zone)}
          disabled={sending}
          className="w-full rounded-md border border-[#d9663f]/60 bg-[#d9663f]/15 py-2 text-sm font-medium text-[#e28e6c] hover:bg-[#d9663f]/25 disabled:opacity-50 transition-colors"
        >
          {sending ? 'Dispatching Broadcast…' : 'Trigger Emergency Alert'}
        </button>
      )}
    </div>
  )
}