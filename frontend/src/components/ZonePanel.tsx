import { useState } from 'react'
import type { Zone } from '../types'
import { riskMeta } from '../lib/risk'
import RiskBreakdown from './RiskBreakdown'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Navigation,
  Compass,
  Zap,
  Camera,
  Copy,
  Check,
  AlertTriangle,
  Activity
} from 'lucide-react'

interface Props {
  zone?: Zone
  onTriggerAlert: (zone: Zone) => void
  sending: boolean
  onOpenReportModal?: (zoneId: string) => void
}

const roadLabel: Record<Zone['roadStatus'], { label: string; color: string; bg: string }> = {
  open: { label: 'Open / Free Flow', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  restricted: { label: 'Restricted / Single Lane', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  blocked: { label: 'Blocked / Heavy Slump', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
}

export default function ZonePanel({ zone, onTriggerAlert, sending, onOpenReportModal }: Props) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  if (!zone) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center rounded-xl border border-[#1f2b27] bg-[#0d1211]/80 p-8 text-center text-sm text-[#596b63] backdrop-blur-md">
        <Compass className="h-10 w-10 text-[#2c3e38] mb-3 animate-pulse" />
        <p className="font-medium text-[#9bb0a6]">No settlement selected</p>
        <p className="text-xs text-[#596b63] mt-1 max-w-xs">
          Click any radar beacon on the geospatial map to view real-time dual-agent ML telemetry.
        </p>
      </div>
    )
  }

  const meta = riskMeta[zone.riskLevel]
  const canAlert = zone.riskLevel === 'high' || zone.riskLevel === 'critical'
  const suscPercent = Math.round((zone.susceptibilityScore ?? 0.4) * 100)
  const triggerPercent = Math.round((zone.triggerProbability ?? 0.5) * 100)
  const rateValue = zone.landslideRate ?? triggerPercent
  const road = roadLabel[zone.roadStatus]

  const handleCopyExplanation = () => {
    if (zone.explanation) {
      navigator.clipboard.writeText(zone.explanation)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-4 shadow-xl border border-[#1f2b27]">
      {/* Zone Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#1f2b27] pb-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className="max-w-[18rem] text-lg font-bold text-[#f0f5f2] leading-tight"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {zone.name}
            </h2>
            <span className="font-mono text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0">
              {zone.id}
            </span>
          </div>
          <p className="text-xs text-[#9bb0a6] flex items-center gap-1.5 mt-0.5">
            <span>{zone.district}</span>
            <span>•</span>
            <span className="font-mono text-[#596b63]">{zone.lat.toFixed(3)}°N, {zone.lng.toFixed(3)}°E</span>
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className={`inline-flex flex-col items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-bold leading-tight ${meta.bg} ${meta.text} border border-current/20 shadow-sm`}>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${meta.dot} animate-ping`} />
              {meta.label}
            </span>
            <span>{zone.riskScore}%</span>
          </span>
          <p className="text-[10px] text-[#596b63] mt-1 font-mono">
            Updated: {new Date(zone.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Dual-Agent ML Engine Architecture */}
      <div className="rounded-lg border border-[#1f2b27] bg-[#090d0c] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
            <Activity className="h-3.5 w-3.5" /> Dual-Agent ML Pipeline
          </span>
          <span className="font-mono text-[10px] text-[#596b63]">HistGradientBoosting v2</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-md border border-[#1a2420] bg-[#101614] p-2.5 space-y-0.5">
            <p className="text-[10px] text-[#9bb0a6]">Agent A (Terrain Susc.)</p>
            <p className="font-mono text-base font-bold text-emerald-400">{suscPercent}%</p>
            <p className="text-[9px] text-[#596b63]">Static Geomorphology</p>
          </div>
          <div className="rounded-md border border-[#1a2420] bg-[#101614] p-2.5 space-y-0.5">
            <p className="text-[10px] text-[#9bb0a6]">Agent B (Rain Trigger)</p>
            <p className="font-mono text-base font-bold text-amber-400">{triggerPercent}%</p>
            <p className="text-[9px] text-[#596b63]">Dynamic Precipitation</p>
          </div>
        </div>
      </div>

      {/* Dynamic Landslide Probability Gauge */}
      <div className="rounded-lg border border-[#1f2b27] bg-[#090d0c] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-cyan-400" />
            <div>
              <p className="text-xs font-semibold text-[#f0f5f2]">Dynamic Landslide Rate</p>
              <p className="text-[10px] text-[#596b63]">Synthesized from live rain & InSAR deformation</p>
            </div>
          </div>
          <span className={`rounded font-mono px-2 py-0.5 text-xs font-bold ${
            rateValue >= 75 ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
            rateValue >= 50 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
            rateValue >= 25 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            {rateValue}% Rate
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-[#141c19] overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                rateValue >= 75 ? 'bg-gradient-to-r from-orange-500 to-red-600' :
                rateValue >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                rateValue >= 25 ? 'bg-gradient-to-r from-emerald-500 to-amber-500' :
                'bg-gradient-to-r from-emerald-600 to-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(6, rateValue))}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[9px] text-[#596b63]">
            <span>Low (&lt;25%)</span>
            <span>Mod (25-50%)</span>
            <span>High (50-75%)</span>
            <span>Crit (75%+)</span>
          </div>
        </div>

        {/* 3 Telemetry Pillars */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded border border-[#1a2420] bg-[#101614] p-2 text-center">
            <p className="text-[10px] text-[#9bb0a6]">24h Rain Load</p>
            <p className="font-mono text-xs font-bold text-emerald-400">{zone.rainfall24h} mm</p>
          </div>
          <div className="rounded border border-[#1a2420] bg-[#101614] p-2 text-center">
            <p className="text-[10px] text-[#9bb0a6]">7d Saturation</p>
            <p className="font-mono text-xs font-bold text-cyan-400">{zone.rainfall7d} mm</p>
          </div>
          <div className="rounded border border-[#1a2420] bg-[#101614] p-2 text-center">
            <p className="text-[10px] text-[#9bb0a6]">InSAR Deform</p>
            <p className="font-mono text-xs font-bold text-amber-400">
              {zone.deformationRateMm ?? ((zone.groundDeformation ?? 0.4) * 32).toFixed(1)}{' '}
              <span className="text-[9px] font-normal text-[#596b63]">mm/y</span>
            </p>
          </div>
        </div>
      </div>

      {/* Road Network & Access Status */}
      <div className={`flex items-center justify-between rounded-lg border p-3 ${road.bg}`}>
        <div className="flex items-center gap-2">
          <Navigation className={`h-4 w-4 ${road.color}`} />
          <div>
            <p className="text-xs font-semibold text-[#f0f5f2]">Road Network Status</p>
            <p className={`text-xs font-medium ${road.color}`}>{road.label}</p>
          </div>
        </div>
        <span className="text-[10px] text-[#9bb0a6]">State Highway Corridor</span>
      </div>

      {/* SHAP Feature Contribution */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[#9bb0a6]">SHAP Feature Weight Contributions</p>
        <RiskBreakdown factors={zone.factors} />
      </div>

      {/* AI Operational Narrative Advisory */}
      {zone.explanation && (
        <div className="rounded-lg border border-[#1f2b27] bg-[#090d0c]/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> AI Operational Advisory
            </span>
            <button
              onClick={handleCopyExplanation}
              className="flex items-center gap-1 text-[11px] text-[#9bb0a6] hover:text-white transition-colors"
              title="Copy advisory note"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[#c2d1cb] font-sans">{zone.explanation}</p>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="space-y-2 pt-1">
        {canAlert && (
          <button
            onClick={() => onTriggerAlert(zone)}
            disabled={sending}
            className="w-full rounded-lg bg-red-600/90 py-2.5 px-4 text-xs font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.4)] hover:bg-red-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            {sending ? 'Broadcasting Alert...' : 'Dispatch Immediate Emergency Alert'}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(`/simulate?zoneId=${zone.id}`)}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 px-3 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" /> Simulate Weather
          </button>
          <button
            onClick={() => onOpenReportModal?.(zone.id)}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 px-3 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" /> Submit Ground Obs
          </button>
        </div>
      </div>
    </div>
  )
}