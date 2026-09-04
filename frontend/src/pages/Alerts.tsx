import { useQuery } from '@tanstack/react-query'
import { fetchAlerts } from '../lib/api'
import { riskMeta } from '../lib/risk'

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `${hrs} hr ago`
}

export default function Alerts() {
  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Alerts
        </h1>
        <p className="text-sm text-[#93a19a]">
          Every warning sent to district administrations, field officers, and citizens.
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-[#d9663f]/40 bg-[#d9663f]/10 px-4 py-3 text-sm text-[#e28e6c]">
          Unable to load alerts. Check the API connection and try again.
        </div>
      )}

      {isLoading && <p className="text-sm text-[#5c6a64]">Loading alerts…</p>}

      <div className="space-y-2">
        {alerts.map((alert) => {
          const meta = riskMeta[alert.level]
          return (
            <div
              key={alert.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-[#26302d] bg-[#121716] p-4"
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <div>
                  <p className="text-sm font-medium text-[#eef2ef]">{alert.zoneName}</p>
                  <p className="text-sm text-[#93a19a]">{alert.message}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-[#5c6a64]">
                    {alert.channel}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs text-[#5c6a64]">{timeAgo(alert.createdAt)}</span>
            </div>
          )
        })}
        {!isLoading && alerts.length === 0 && (
          <p className="text-sm text-[#5c6a64]">No alerts yet.</p>
        )}
      </div>
    </div>
  )
}