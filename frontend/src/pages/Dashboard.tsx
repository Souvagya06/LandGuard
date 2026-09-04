import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchZones, triggerAlert } from '../lib/api'
import type { Zone } from '../types'
import MetricCard from '../components/MetricCard'
import RiskMap from '../components/RiskMap'
import ZonePanel from '../components/ZonePanel'
import AnalysisPanel from '../components/AnalysisPanel'
import { riskMeta } from '../lib/risk'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const { data: zones = [], isLoading, isError } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    refetchInterval: 15000,
  })

  const activeId = selectedId ?? zones[0]?.id
  const selectedZone = zones.find((z) => z.id === activeId)

  const alertMutation = useMutation({
    mutationFn: triggerAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const metrics = useMemo(() => {
    const high = zones.filter((z) => z.riskLevel === 'high' || z.riskLevel === 'critical').length
    const avgRain = zones.length
      ? Math.round(zones.reduce((s, z) => s + z.rainfall24h, 0) / zones.length)
      : 0
    return { high, avgRain, villages: zones.length }
  }, [zones])

  return (
    <div className="dashboard-page space-y-6">
      {isError && (
        <div className="rounded-lg border border-[#d9663f]/40 bg-[#d9663f]/10 px-4 py-3 text-sm text-[#e28e6c]">
          Unable to load zone data. Check the API connection and try again.
        </div>
      )}
      <div className="dashboard-intro flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#57b79e]">Operations overview</p>
          <h1 className="text-2xl font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Risk dashboard
          </h1>
          <p className="mt-1 text-sm text-[#93a19a]">
            Real-time landslide risk across monitored zones in the North Eastern Region.
          </p>
        </div>
        <div className="flex items-center gap-2 border border-[#26302d] bg-[#121716] px-3 py-2 text-xs text-[#93a19a]">
          <span className="h-2 w-2 rounded-full bg-[#57b79e] shadow-[0_0_10px_#57b79e]" />
          Live monitoring
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="High-risk zones" value={metrics.high} />
        <MetricCard label="Villages monitored" value={metrics.villages} />
        <MetricCard label="Avg rainfall 24h" value={`${metrics.avgRain}mm`} />
        <MetricCard label="Model status" value={isLoading ? 'Syncing…' : 'Live'} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <RiskMap zones={zones} selectedId={activeId} onSelect={(z: Zone) => setSelectedId(z.id)} />
          <div className="flex flex-wrap gap-3 text-xs text-[#93a19a]">
            {(Object.keys(riskMeta) as (keyof typeof riskMeta)[]).map((lvl) => (
              <span key={lvl} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${riskMeta[lvl].dot}`} />
                {riskMeta[lvl].label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setSelectedId(zone.id)}
                className={`rounded-md border p-2.5 text-left transition-colors ${
                  zone.id === selectedId
                    ? 'border-[#57b79e] bg-[#121716]'
                    : 'border-[#26302d] hover:border-[#3a453f]'
                }`}
              >
                <p className="truncate text-xs font-medium text-[#eef2ef]">{zone.name}</p>
                <p className="text-[11px] text-[#93a19a]">{zone.riskScore}% risk</p>
              </button>
            ))}
          </div>
        </div>

        <ZonePanel
          zone={selectedZone}
          onTriggerAlert={(z) => alertMutation.mutate(z)}
          sending={alertMutation.isPending}
        />
      </div>

      <AnalysisPanel zones={zones} selectedZone={selectedZone} />
    </div>
  )
}