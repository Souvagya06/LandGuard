import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchZones, triggerAlert } from '../lib/api'
import type { Zone } from '../types'
import MetricCard from '../components/MetricCard'
import RiskMap from '../components/RiskMap'
import ZonePanel from '../components/ZonePanel'
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
    <div className="space-y-6">
      {isError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Unable to load zone data. Check the API connection and try again.</div>}
      <div>
        <h1 className="text-lg font-medium text-neutral-900">Risk dashboard</h1>
        <p className="text-sm text-neutral-500">
          Real-time landslide risk across monitored zones in the North Eastern Region.
        </p>
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
          <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
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
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  zone.id === selectedId
                    ? 'border-neutral-800 bg-neutral-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <p className="truncate text-xs font-medium text-neutral-800">{zone.name}</p>
                <p className="text-[11px] text-neutral-500">{zone.riskScore}% risk</p>
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
    </div>
  )
}
