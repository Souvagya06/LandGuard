import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, BellRing, Database, RefreshCw, Satellite, Server, Smartphone } from 'lucide-react'
import { fetchDevices, refreshMonitoring } from '../lib/api'
import { API_BASE } from '../lib/config'
import { useConsoleDataState } from '../lib/queries'
import { dataStateMeta } from '../lib/dataState'
import { describeReason } from '../lib/delivery'
import { riskMeta } from '../lib/risk'
import { formatDateTime, timeAgo } from '../lib/format'
import { Button, DataStateBadge, MetricTile, PageHeader, Row, SectionLabel } from '../components/ui'

function Panel({ icon: Icon, title, children }: { icon: typeof Server; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-brand-light" /><SectionLabel>{title}</SectionLabel></div>
      {children}
    </section>
  )
}

const Ok = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className="font-bold" style={{ color: ok ? '#16A34A' : '#DC2626' }}>{children}</span>
)

export default function SystemStatusPage() {
  const queryClient = useQueryClient()
  const { state, realtime, system } = useConsoleDataState()
  const devices = useQuery({ queryKey: ['devices'], queryFn: fetchDevices, refetchInterval: 60_000 })
  const refresh = useMutation({ mutationFn: refreshMonitoring, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['monitoring'] }); queryClient.invalidateQueries({ queryKey: ['system'] }) } })
  const s = system.data
  const m = s?.monitoring

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="System status"
        subtitle="Health of the shared LandGuard backend that serves this console and every Android device."
        actions={<Button variant="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} /> Refresh monitoring now</Button>}
      />
      {refresh.isError && <p className="rounded-[14px] bg-critical-bg px-3 py-2 text-[13px] text-critical">{(refresh.error as Error).message}</p>}
      {system.isError && <p className="rounded-[14px] bg-critical-bg px-3 py-2 text-[13px] text-critical">Backend unreachable: {(system.error as Error).message}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel icon={Server} title="Backend">
          <div className="divide-y divide-divider">
            <Row label="API">{s ? <Ok ok>Online · v{s.version}</Ok> : <Ok ok={false}>Unreachable</Ok>}</Row>
            <Row label="Endpoint"><span className="font-mono text-[12px]">{API_BASE}</span></Row>
            <Row label="Server time">{formatDateTime(s?.time)}</Row>
            <Row label="Authority sign-in">{s ? (s.security.authenticationRequired ? 'Required' : 'Not required (development)') : '—'}</Row>
            <Row label="Console data">
              <span className="inline-flex items-center gap-2"><DataStateBadge state={state} /></span>
            </Row>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">{dataStateMeta[state].description}</p>
        </Panel>

        <Panel icon={BellRing} title="Alert channels">
          <div className="divide-y divide-divider">
            <Row label="Firebase (FCM)">{s ? (s.push.configured ? <Ok ok>Configured</Ok> : <Ok ok={false}>Not configured</Ok>) : '—'}</Row>
            {s && !s.push.configured && <p className="py-2 text-left text-[12px] text-critical">{describeReason(s.push.reason)}</p>}
            <Row label="Realtime channel">{realtime === 'open' ? <Ok ok>Connected</Ok> : realtime === 'connecting' ? 'Connecting…' : <Ok ok={false}>Disconnected</Ok>}</Row>
            <Row label="Realtime clients">{s?.realtime.connectedClients ?? '—'}</Row>
            <Row label="Offline mesh">Android Nearby Connections (device-to-device, no server)</Row>
            <Row label="Active alerts">{s?.alerts.active ?? '—'} active · {s?.alerts.awaitingApproval ?? '—'} awaiting approval</Row>
          </div>
        </Panel>

        <Panel icon={Smartphone} title="Registered devices">
          <div className="grid grid-cols-3 gap-2">
            <MetricTile value={s?.devices.registered ?? '—'} label="Registered" />
            <MetricTile value={s?.devices.android ?? '—'} label="Android" />
            <MetricTile value={s?.devices.activeLast7Days ?? '—'} label="Seen in 7 days" />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">Last registration {timeAgo(s?.devices.lastRegistrationAt)}. Tokens are never shown; invalid tokens are removed automatically after FCM rejects them.</p>
          {devices.data && devices.data.devices.length > 0 && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-[14px] border border-line">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-elevated text-[11px] uppercase tracking-[0.06em] text-ink-3"><tr><th className="px-3 py-2">Device</th><th className="px-3 py-2">App</th><th className="px-3 py-2">Registered</th><th className="px-3 py-2">Last seen</th></tr></thead>
                <tbody className="divide-y divide-divider">
                  {devices.data.devices.map((d) => (
                    <tr key={d.id}><td className="px-3 py-2 font-mono text-[11px]">{d.id.slice(0, 8)} · {d.platform}</td><td className="px-3 py-2">{d.appVersion ?? '—'}</td><td className="px-3 py-2">{timeAgo(d.registeredAt)}</td><td className="px-3 py-2">{timeAgo(d.lastSeenAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel icon={Database} title="Data freshness">
          <div className="divide-y divide-divider">
            <Row label="Rainfall & soil">{m?.conditions.observedAt ? `${formatDateTime(m.conditions.observedAt)} (${timeAgo(m.conditions.observedAt)})` : 'DATA UNAVAILABLE'}</Row>
            <Row label="Conditions state">{m ? m.conditions.state.toUpperCase() : '—'} · every {m?.conditions.refreshMinutes ?? '—'} min</Row>
            <Row label="Areas with rainfall">{m ? `${m.conditions.zonesWithRainfall} / ${m.zones}` : '—'}</Row>
            <Row label="Areas with terrain">{m ? `${m.conditions.zonesWithTerrain} / ${m.zones}` : '—'}</Row>
            <Row label="Landslide catalog">{m?.catalog.fetchedAt ? `${m.catalog.events} events · downloaded ${timeAgo(m.catalog.fetchedAt)}` : 'DATA UNAVAILABLE'}</Row>
            {m?.conditions.error && <Row label="Last error"><span className="text-critical">{m.conditions.error}</span></Row>}
          </div>
        </Panel>

        <Panel icon={Satellite} title="Sources">
          <div className="divide-y divide-divider">
            <Row label="Rainfall">{m?.conditions.rainfallSource ?? '—'}</Row>
            <Row label="Terrain (DEM)">{m?.conditions.terrainSource ?? '—'}</Row>
            <Row label="Landslide record">NASA Global Landslide Catalog</Row>
            <Row label="Sentinel-2">{m?.satellite.sentinel2 ?? '—'}</Row>
            <Row label="Sentinel-1 SAR">{m?.satellite.sentinel1 ?? '—'}</Row>
            <Row label="ALOS-4 PALSAR-3"><span className="text-ink-2">{m?.satellite.alos4 ?? '—'}</span></Row>
          </div>
        </Panel>

        <Panel icon={Activity} title="Monitoring coverage">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {s?.riskBands.slice().reverse().map((band) => (
              <MetricTile key={band.level} value={m?.byLevel[band.level] ?? '—'} label={`${riskMeta[band.level].label} (${band.min}–${band.max})`} accent={riskMeta[band.level].accent} />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-2">{m ? `${m.zones} monitored areas derived from recorded landslides across ${m.region.states.length} states: ${m.region.states.join(', ')}.` : '—'}</p>
        </Panel>
      </div>
    </div>
  )
}
