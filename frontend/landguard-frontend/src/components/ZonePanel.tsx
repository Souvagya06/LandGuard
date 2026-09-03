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
      <div className="flex h-full items-center justify-center rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
        Select a zone on the map to see its risk breakdown
      </div>
    )
  }

  const meta = riskMeta[zone.riskLevel]
  const canAlert = zone.riskLevel === 'high' || zone.riskLevel === 'critical'

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-medium text-neutral-900">{zone.name}</p>
          <p className="text-xs text-neutral-500">{zone.district}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.text}`}>
          {meta.label} · {zone.riskScore}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[11px] text-neutral-500">Rain 24h</p>
          <p className="text-sm font-medium">{zone.rainfall24h}mm</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[11px] text-neutral-500">Rain 7d</p>
          <p className="text-sm font-medium">{zone.rainfall7d}mm</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[11px] text-neutral-500">Road</p>
          <p className="text-sm font-medium">{roadLabel[zone.roadStatus]}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-neutral-500">Why this score (SHAP)</p>
        <RiskBreakdown factors={zone.factors} />
      </div>

      {canAlert && (
        <button
          onClick={() => onTriggerAlert(zone)}
          disabled={sending}
          className="mt-5 w-full rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Trigger test alert'}
        </button>
      )}
    </div>
  )
}
