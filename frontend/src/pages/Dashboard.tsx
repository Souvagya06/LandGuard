import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CloudRain, Crosshair, Database, RefreshCw, X } from 'lucide-react'
import RiskMap from '../components/RiskMap'
import ZoneDetail, { FactorBars, SatelliteReadings, ScoreRing } from '../components/ZoneDetail'
import { DataStateBadge, MetricTile, SeverityDot, SeverityPill, Unavailable } from '../components/ui'
import { fetchAnalysis, fetchReports } from '../lib/api'
import { useAuthorityAlerts, useConsoleDataState } from '../lib/queries'
import { RISK_LEVELS, riskMeta } from '../lib/risk'
import { timeAgo } from '../lib/format'
import type { PublicAlert, RiskLevel } from '../types'

function PointAnalysis({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const analysis = useQuery({ queryKey: ['analysis', lat.toFixed(2), lng.toFixed(2)], queryFn: () => fetchAnalysis(lat, lng), staleTime: 30 * 60_000 })
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-divider p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3">Location analysis</p>
          <h2 className="mt-0.5 text-[18px] font-extrabold text-ink">{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</h2>
          <p className="text-[11.5px] text-ink-3">Same inputs and model as the app's “analyse my location”.</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-elevated" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {analysis.isLoading && <p className="rounded-[14px] bg-elevated px-3 py-3 text-[12px] text-ink-2">Querying rainfall, DEM, Sentinel-2 and Sentinel-1…</p>}
        {analysis.isError && <Unavailable reason={(analysis.error as Error).message} />}
        {analysis.data && (
          <>
            {analysis.data.risk.available ? (
              <div className="flex items-center gap-4">
                <ScoreRing risk={analysis.data.risk.value} />
                <div><SeverityPill level={analysis.data.risk.value.level} /><p className="mt-1 text-[11.5px] text-ink-2">Analysed {timeAgo(analysis.data.analysedAt)}</p></div>
              </div>
            ) : <Unavailable reason={analysis.data.risk.reason} />}
            {analysis.data.risk.available && <FactorBars risk={analysis.data.risk.value} />}
            <SatelliteReadings analysis={analysis.data} />
            {!analysis.data.rainfall.available && <Unavailable compact reason={analysis.data.rainfall.reason} />}
            {!analysis.data.terrain.available && <Unavailable compact reason={analysis.data.terrain.reason} />}
          </>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('zone') ?? undefined
  const [levelFilter, setLevelFilter] = useState<'all' | RiskLevel>('all')
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
  const { state, zones: zonesQuery, system } = useConsoleDataState()
  const alertsQuery = useAuthorityAlerts()
  const reports = useQuery({ queryKey: ['reports'], queryFn: fetchReports, refetchInterval: 120_000 })

  const zones = useMemo(() => zonesQuery.data?.zones ?? [], [zonesQuery.data])
  const ranked = useMemo(() => [...zones].sort((a, b) => b.risk.score - a.risk.score), [zones])
  const listed = ranked.filter((z) => levelFilter === 'all' || z.risk.level === levelFilter)
  const activeAlerts: PublicAlert[] = (alertsQuery.data ?? []).filter((a) => a.status === 'active')
  const selected = zones.find((z) => z.id === selectedId)
  const conditions = zonesQuery.data?.conditions
  const catalog = zonesQuery.data?.catalog
  const summary = system.data?.monitoring

  const select = (id: string | undefined) => {
    setPoint(null)
    const next = new URLSearchParams(params)
    if (id) next.set('zone', id)
    else next.delete('zone')
    setParams(next, { replace: true })
  }

  const count = (level: RiskLevel) => zones.filter((z) => z.risk.level === level).length

  return (
    <div className="page-enter relative flex flex-col lg:block lg:h-[calc(100vh-3.5rem)]">
      {/* Map-first canvas */}
      <div className="h-[58vh] lg:absolute lg:inset-0 lg:h-auto">
        {state === 'OFFLINE' && !zones.length ? (
          <div className="flex h-full items-center justify-center bg-elevated p-6">
            <div className="max-w-md text-center">
              <DataStateBadge state="OFFLINE" />
              <p className="mt-3 text-[16px] font-extrabold text-ink">Monitoring data unavailable</p>
              <p className="mt-1 text-[13px] text-ink-2">The LandGuard backend cannot be reached, so no risk data is shown. Nothing is simulated in its place.</p>
            </div>
          </div>
        ) : (
          <RiskMap
            zones={zones}
            selectedId={selectedId}
            onSelect={(z) => select(z.id)}
            activeAlerts={activeAlerts}
            fieldReports={reports.data ?? []}
            regionBounds={summary?.region.bounds}
            onAnalyzePoint={(lat, lng) => { select(undefined); setPoint({ lat, lng }) }}
            levelFilter={levelFilter}
            onLevelFilterChange={setLevelFilter}
          />
        )}
      </div>

      {/* Left panel — region overview and ranked areas */}
      <aside className="glass z-[1050] m-3 flex flex-col overflow-hidden rounded-[20px] lg:absolute lg:bottom-16 lg:left-0 lg:top-16 lg:m-0 lg:ml-3 lg:w-[340px]">
        <div className="border-b border-divider p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3">Live monitoring</p>
              <h1 className="text-[19px] font-extrabold text-ink">Northeast India</h1>
            </div>
            <DataStateBadge state={state} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {RISK_LEVELS.map((level) => (
              <button key={level} onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)} className="text-left">
                <MetricTile value={count(level)} label={riskMeta[level].label} accent={riskMeta[level].accent} />
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-[11.5px] text-ink-2">
            <p className="flex items-center gap-1.5"><CloudRain className="h-3.5 w-3.5 text-brand-light" />
              {conditions?.observedAt ? <>Rainfall observed {timeAgo(conditions.observedAt)} · refresh every {conditions.refreshMinutes} min</> : 'Rainfall: DATA UNAVAILABLE'}
            </p>
            <p className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-brand-light" />
              {catalog?.events ? <>{catalog.events} recorded landslides (NASA GLC) · {zones.length} areas · 8 states</> : 'Landslide catalog: DATA UNAVAILABLE'}
            </p>
            {conditions?.error && <p className="flex items-center gap-1.5 text-high"><AlertTriangle className="h-3.5 w-3.5" /> {conditions.error}</p>}
            <p className="flex items-center gap-1.5 text-ink-3"><Crosshair className="h-3.5 w-3.5" /> Click an area for details, or anywhere on the map to analyse a location.</p>
          </div>
        </div>

        {activeAlerts.length > 0 && (
          <div className="border-b border-divider bg-critical-bg/60 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-critical">{activeAlerts.length} active alert{activeAlerts.length === 1 ? '' : 's'}</p>
            <div className="mt-1.5 space-y-1">
              {activeAlerts.slice(0, 3).map((a) => (
                <button key={a.alertId} onClick={() => select(a.zoneId)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-surface">
                  <SeverityDot level={a.level} size={8} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{a.zoneName}</span>
                  <span className="text-[11px] text-ink-3">expires {timeAgo(a.expiresAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">{levelFilter === 'all' ? 'All areas by risk' : `${riskMeta[levelFilter].label} risk areas`} · {listed.length}</p>
          <button onClick={() => zonesQuery.refetch()} title="Reload from backend" className="rounded-lg p-1 text-ink-3 hover:bg-elevated hover:text-ink">
            <RefreshCw className={`h-3.5 w-3.5 ${zonesQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="max-h-[40vh] flex-1 space-y-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
          {zonesQuery.isLoading && <p className="px-2 py-4 text-[12px] text-ink-3">Loading monitored areas…</p>}
          {listed.map((zone, index) => (
            <button
              key={zone.id}
              onClick={() => select(zone.id)}
              className={`flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors ${zone.id === selectedId ? 'bg-brand-container' : 'hover:bg-elevated'}`}
            >
              <span className="w-7 text-[12px] font-extrabold" style={{ color: riskMeta[zone.risk.level].accent }}>#{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-ink">{zone.name}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {zone.state} · {zone.rainfall ? `${zone.rainfall.past72hMm.toFixed(0)} mm / 72 h` : 'rain unavailable'} · {zone.eventCount} recorded
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[16px] font-extrabold leading-tight text-ink">{zone.risk.score}</span>
                <SeverityPill level={zone.risk.level} className="mt-0.5" />
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Right panel — selected area / point */}
      {(selected || point) && (
        <aside className="glass z-[1050] m-3 overflow-hidden rounded-[20px] lg:absolute lg:bottom-16 lg:right-3 lg:top-16 lg:m-0 lg:w-[400px]">
          {selected && <ZoneDetail zone={selected} alerts={alertsQuery.data ?? []} onClose={() => select(undefined)} />}
          {!selected && point && <PointAnalysis lat={point.lat} lng={point.lng} onClose={() => setPoint(null)} />}
        </aside>
      )}

    </div>
  )
}
