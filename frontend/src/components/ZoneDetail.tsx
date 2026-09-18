import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CloudRain, ExternalLink, Mountain, Satellite, Send, History, X } from 'lucide-react'
import type { LocationAnalysis, MonitoringZone, PublicAlert, RiskIndex } from '../types'
import { fetchAnalysis, fetchMonitoringZone } from '../lib/api'
import { riskMeta } from '../lib/risk'
import { formatDate, formatDateTime, timeAgo } from '../lib/format'
import { AlertStatusPill, Button, Row, SectionLabel, SeverityPill, Unavailable } from './ui'

/** Android Home "Current Land Risk" ring. */
export function ScoreRing({ risk, size = 92 }: { risk: RiskIndex; size?: number }) {
  const meta = riskMeta[risk.level]
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={meta.container} strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={meta.accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(risk.score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold leading-none text-ink">{risk.score}</span>
        <span className="text-[10px] font-medium text-ink-3">/ 100</span>
      </div>
    </div>
  )
}

export function FactorBars({ risk }: { risk: RiskIndex }) {
  return (
    <div className="space-y-2.5">
      {risk.factors.map((f) => (
        <div key={f.name}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="font-bold text-ink">{f.name} <span className="font-medium text-ink-3">· weight {Math.round(f.weight * 100)}%</span></span>
            <span className="font-extrabold text-ink">{f.score}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: riskMeta[risk.level].accent }} />
          </div>
          <p className="mt-0.5 text-[11px] text-ink-3">{f.detail}</p>
        </div>
      ))}
      <p className="rounded-xl bg-elevated px-3 py-2 text-[11.5px] text-ink-2">
        {Math.round(risk.coverage * 100)}% of the model weight is backed by real data; missing inputs are excluded, never estimated.
      </p>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof CloudRain; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-divider pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-light" />
        <SectionLabel>{title}</SectionLabel>
      </div>
      {children}
    </section>
  )
}

/** Sentinel-2 / Sentinel-1 / ALOS-4 readings — shown exactly as the backend reports them. */
export function SatelliteReadings({ analysis }: { analysis: LocationAnalysis }) {
  const { optical, sar, alos4 } = analysis
  return (
    <div className="space-y-2">
      {optical.available ? (
        <div className="rounded-[14px] border border-line p-3">
          <p className="text-[12px] font-bold text-sentinel">Sentinel-2 L2A · vegetation (NDVI)</p>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{optical.value.ndvi.toFixed(2)}
            {optical.value.ndviChange !== null && <span className="ml-2 text-[12px] font-bold" style={{ color: optical.value.ndviChange < -0.05 ? '#DC2626' : '#4A6558' }}>{optical.value.ndviChange >= 0 ? '+' : ''}{optical.value.ndviChange.toFixed(2)} vs a year earlier</span>}
          </p>
          <p className="text-[11px] text-ink-3">Scene {formatDate(optical.value.acquiredMillis)} · {Math.round(optical.value.clearFraction * 100)}% cloud-free{optical.value.baseline ? ` · baseline ${formatDate(optical.value.baseline.acquiredMillis)}` : ' · no clear baseline scene'}</p>
        </div>
      ) : <Unavailable compact reason={`Sentinel-2: ${optical.reason}`} />}
      {sar.available ? (
        <div className="rounded-[14px] border border-line p-3">
          <p className="text-[12px] font-bold text-sentinel">Sentinel-1 RTC · ground surface change (SAR)</p>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{sar.value.vvDb.toFixed(1)} dB
            {sar.value.vvChangeDb !== null && <span className="ml-2 text-[12px] font-bold" style={{ color: Math.abs(sar.value.vvChangeDb) >= 1.5 ? '#EA580C' : '#4A6558' }}>{sar.value.vvChangeDb >= 0 ? '+' : ''}{sar.value.vvChangeDb.toFixed(1)} dB vs a year earlier</span>}
          </p>
          <p className="text-[11px] text-ink-3">Pass {formatDate(sar.value.acquiredMillis)}{sar.value.baselineAcquiredMillis ? ` · baseline ${formatDate(sar.value.baselineAcquiredMillis)}` : ' · no same-orbit baseline'}</p>
        </div>
      ) : <Unavailable compact reason={`Sentinel-1: ${sar.reason}`} />}
      {!alos4.available && <Unavailable compact reason={`ALOS-4 PALSAR-3: ${alos4.reason}`} />}
    </div>
  )
}

export default function ZoneDetail({ zone, alerts, onClose }: { zone: MonitoringZone; alerts: PublicAlert[]; onClose: () => void }) {
  const navigate = useNavigate()
  const detail = useQuery({ queryKey: ['monitoring', 'zone', zone.id], queryFn: () => fetchMonitoringZone(zone.id) })
  const analysis = useQuery({ queryKey: ['analysis', zone.lat.toFixed(2), zone.lng.toFixed(2)], queryFn: () => fetchAnalysis(zone.lat, zone.lng), enabled: false, staleTime: 30 * 60_000 })
  const zoneAlerts = alerts.filter((a) => a.zoneId === zone.id)
  const events = detail.data?.events ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-divider p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3">Monitored area · {zone.state}</p>
          <h2 className="mt-0.5 text-[19px] font-extrabold leading-tight text-ink">{zone.name}</h2>
          <p className="mt-0.5 text-[11.5px] text-ink-3">{zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E · ID {zone.id}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-elevated hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-4">
          <ScoreRing risk={zone.risk} />
          <div className="min-w-0">
            <p className="text-[12px] text-ink-3">Current land risk</p>
            <p className="text-[20px] font-extrabold" style={{ color: riskMeta[zone.risk.level].accent }}>{riskMeta[zone.risk.level].label} risk</p>
            <p className="mt-1 text-[11.5px] text-ink-2">Same index and thresholds as the LandGuard app (25 / 50 / 75).</p>
          </div>
        </div>

        {zoneAlerts.length > 0 && (
          <div className="space-y-2">
            {zoneAlerts.map((a) => (
              <div key={a.alertId} className="rounded-[14px] border border-critical/30 bg-critical-bg p-3">
                <div className="flex items-center gap-2"><SeverityPill level={a.level} /><AlertStatusPill status={a.status} /><span className="ml-auto text-[11px] text-ink-3">{timeAgo(a.timestamp)}</span></div>
                <p className="mt-1.5 text-[12.5px] text-ink">{a.message}</p>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={() => navigate(`/send-alert?zone=${encodeURIComponent(zone.id)}`)}>
          <Send className="h-4 w-4" /> Issue alert for this area
        </Button>

        <Section icon={History} title="Risk factors">
          <FactorBars risk={zone.risk} />
        </Section>

        <Section icon={CloudRain} title="Rainfall & soil">
          {zone.rainfall ? (
            <div className="divide-y divide-divider">
              <Row label="Past 72 h">{zone.rainfall.past72hMm.toFixed(0)} mm</Row>
              <Row label="Next 24 h (forecast)">{zone.rainfall.next24hMm.toFixed(0)} mm</Row>
              <Row label="Topsoil moisture">{zone.rainfall.soilMoistureM3M3 === null ? 'Unavailable' : `${zone.rainfall.soilMoistureM3M3.toFixed(2)} m³/m³`}</Row>
              <Row label="Observed">{formatDateTime(zone.rainfall.observedAt)} ({timeAgo(zone.rainfall.observedAt)})</Row>
              <Row label="Source">{zone.rainfall.source}</Row>
            </div>
          ) : <Unavailable reason="No rainfall observation is available for this area yet." />}
        </Section>

        <Section icon={Mountain} title="Terrain">
          {zone.terrain ? (
            <div className="divide-y divide-divider">
              <Row label="Mean slope">{zone.terrain.slopeDeg.toFixed(0)}°</Row>
              <Row label="Elevation">{zone.terrain.elevationM.toFixed(0)} m</Row>
              <Row label="Source">{zone.terrain.source}</Row>
            </div>
          ) : <Unavailable reason="Elevation data is unavailable for this area." />}
        </Section>

        <Section icon={Satellite} title="Satellite observations">
          {analysis.data ? (
            <>
              <SatelliteReadings analysis={analysis.data} />
              <p className="mt-2 text-[11px] text-ink-3">Analysed {timeAgo(analysis.data.analysedAt)} over a ≈2.2 km box at the area centre.</p>
            </>
          ) : analysis.isFetching ? (
            <p className="rounded-[14px] bg-elevated px-3 py-3 text-[12px] text-ink-2">Querying Sentinel-2 and Sentinel-1 archives…</p>
          ) : (
            <div className="space-y-2">
              {analysis.isError && <Unavailable compact reason={(analysis.error as Error).message} />}
              <Button variant="secondary" className="w-full" onClick={() => analysis.refetch()}>
                <Satellite className="h-4 w-4" /> Load latest Sentinel-2 / Sentinel-1 readings
              </Button>
            </div>
          )}
        </Section>

        <Section icon={History} title="Landslide record (NASA GLC)">
          <div className="divide-y divide-divider">
            <Row label="Recorded landslides">{zone.eventCount}</Row>
            <Row label="Fatalities recorded">{zone.fatalities}</Row>
            <Row label="Period">{formatDate(zone.firstEventAt)} – {formatDate(zone.lastEventAt)}</Row>
            {zone.dominantTrigger && <Row label="Main trigger">{zone.dominantTrigger}</Row>}
          </div>
          <div className="mt-2 space-y-1.5">
            {events.slice(0, 5).map((e) => (
              <div key={e.id} className="rounded-xl bg-elevated px-3 py-2">
                <p className="text-[12px] font-semibold text-ink">{e.title}</p>
                <p className="text-[11px] text-ink-3">
                  {formatDate(e.dateMillis)}{e.trigger ? ` · ${e.trigger}` : ''}{e.fatalities ? ` · ${e.fatalities} fatalities` : ''}
                  {e.sourceLink && <a href={e.sourceLink} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center gap-0.5 text-brand hover:underline">source <ExternalLink className="h-3 w-3" /></a>}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-3">Historical record — never presented as a live observation.</p>
        </Section>
      </div>
    </div>
  )
}
