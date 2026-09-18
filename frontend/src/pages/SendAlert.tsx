import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Bell, Radio, Search, Send, ShieldCheck } from 'lucide-react'
import { approveAlert, createAlert, fetchSession } from '../lib/api'
import { useAuthorityAlerts, useMonitoringZones, useSystemStatus } from '../lib/queries'
import { RISK_LEVELS, riskMeta } from '../lib/risk'
import { roleLabel } from '../lib/format'
import type { MonitoringZone, RiskLevel } from '../types'
import { AlertStatusPill, Button, PageHeader, SectionLabel, SeverityPill } from '../components/ui'
import DeliveryPanel from '../components/DeliveryPanel'

const EXPIRY_OPTIONS = [
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 360, label: '6 hours' },
  { minutes: 720, label: '12 hours' },
  { minutes: 1440, label: '24 hours' },
  { minutes: 2880, label: '48 hours' },
  { minutes: 4320, label: '72 hours' },
]

const LEVEL_COPY: Record<RiskLevel, { title: string; description: string; action: string }> = {
  critical: { title: 'Critical', description: 'Imminent danger. Evacuation or immediate protective action.', action: 'Move away from steep slopes, road cuts and drainage lines now and follow evacuation instructions from local authorities.' },
  high: { title: 'High', description: 'Landslides likely. Restrict movement and prepare to act.', action: 'Avoid travel near slopes and road cuts, keep emergency kits ready and follow instructions from local authorities.' },
  moderate: { title: 'Moderate', description: 'Elevated risk. Caution and heightened watch.', action: 'Stay alert for cracks, tilting trees or muddy water, and avoid unnecessary travel on hill roads.' },
  low: { title: 'Low', description: 'Advisory or all-clear information.', action: 'No immediate action required. Report unusual ground movement to local authorities.' },
}

const template = (zone: MonitoringZone, level: RiskLevel) =>
  `${riskMeta[level].label.toUpperCase()} LANDSLIDE ALERT: ${zone.name} (${zone.state}). ${LEVEL_COPY[level].action}`

export default function SendAlert() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const zonesQuery = useMonitoringZones()
  const system = useSystemStatus()
  const alerts = useAuthorityAlerts()
  const session = useQuery({ queryKey: ['session'], queryFn: fetchSession, staleTime: 5 * 60_000 })

  const zones = useMemo(() => [...(zonesQuery.data?.zones ?? [])].sort((a, b) => b.risk.score - a.risk.score), [zonesQuery.data])
  const [zoneId, setZoneId] = useState(params.get('zone') ?? '')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<RiskLevel>('critical')
  const [expiry, setExpiry] = useState(1440)
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [sentId, setSentId] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const zone = zones.find((z) => z.id === zoneId) ?? (zoneId ? undefined : zones[0])
  const message = customMessage ?? (zone ? template(zone, level) : '')
  const role = session.data?.user.role
  const canApprove = role === 'incident_commander' || role === 'admin'
  const needsApproval = (level === 'high' || level === 'critical') && !canApprove
  const push = system.data?.push
  const devices = system.data?.devices.registered ?? 0
  const sent = alerts.data?.find((a) => a.alertId === sentId)

  const q = search.trim().toLowerCase()
  const matches = q ? zones.filter((z) => z.name.toLowerCase().includes(q) || z.state.toLowerCase().includes(q) || z.id.includes(q)) : zones

  const send = useMutation({
    mutationFn: () => createAlert({ zoneId: zone!.id, level, message: message.trim(), expiresInMinutes: expiry, clientRequestId: requestId }),
    onSuccess: (alert) => {
      setSentId(alert.alertId)
      queryClient.setQueryData(['alerts', 'authority'], (old: typeof alerts.data) => [alert, ...(old ?? []).filter((a) => a.alertId !== alert.alertId)])
      queryClient.invalidateQueries({ queryKey: ['system'] })
    },
  })
  const approve = useMutation({
    mutationFn: (id: string) => approveAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!zone || !message.trim()) return
    send.mutate()
  }

  function reset() {
    setSentId(null)
    setCustomMessage(null)
    setRequestId(crypto.randomUUID())
    send.reset()
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Send alert"
        subtitle="Alerts go from this console to the LandGuard backend, then by Firebase Cloud Messaging to every registered device, then over the offline mesh between nearby phones."
      />

      {push && !push.configured && (
        <div className="flex items-start gap-3 rounded-[20px] border border-critical/30 bg-critical-bg p-4 text-critical">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-[13px] font-medium">Push delivery is not configured on the server. Alerts will be stored and shown to devices when they sync, but no push notification will be sent until Firebase Admin credentials are configured.</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <form onSubmit={submit} className="card space-y-6 p-5 sm:p-6">
          {/* 1 · Area */}
          <section className="space-y-2">
            <SectionLabel>1 · Monitored area</SectionLabel>
            <label className="flex items-center gap-2 rounded-[14px] border border-line bg-elevated px-3 py-2.5">
              <Search className="h-4 w-4 text-ink-3" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${zones.length} monitored areas…`} className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-3" />
            </label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-[14px] border border-line p-1" role="listbox" aria-label="Monitored areas">
              {zonesQuery.isLoading && <p className="p-3 text-[12px] text-ink-3">Loading monitored areas…</p>}
              {zonesQuery.isError && <p className="p-3 text-[12px] text-critical">Monitored areas are unavailable: {(zonesQuery.error as Error).message}</p>}
              {matches.map((z) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={z.id === zone?.id}
                  key={z.id}
                  onClick={() => { setZoneId(z.id); setCustomMessage(null) }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${z.id === zone?.id ? 'bg-brand-container ring-1 ring-brand/40' : 'hover:bg-elevated'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink">{z.name}</span>
                    <span className="block text-[11px] text-ink-3">{z.state} · score {z.risk.score} · {z.rainfall ? `${z.rainfall.past72hMm.toFixed(0)} mm / 72 h` : 'rain unavailable'}</span>
                  </span>
                  <SeverityPill level={z.risk.level} />
                </button>
              ))}
            </div>
          </section>

          {/* 2 · Level */}
          <fieldset className="space-y-2">
            <legend><SectionLabel>2 · Alert level</SectionLabel></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {RISK_LEVELS.map((l) => {
                const on = level === l
                const meta = riskMeta[l]
                return (
                  <label key={l} className="cursor-pointer rounded-[14px] border p-3 transition-colors" style={on ? { borderColor: meta.accent, background: meta.container } : { borderColor: '#E1E8E3' }}>
                    <input type="radio" name="level" value={l} checked={on} onChange={() => { setLevel(l); setCustomMessage(null) }} className="sr-only" />
                    <div className="flex items-center justify-between"><SeverityPill level={l} />{(l === 'high' || l === 'critical') && <span className="text-[10.5px] font-bold text-ink-3">Two-person rule</span>}</div>
                    <p className="mt-1.5 text-[12px] text-ink-2">{LEVEL_COPY[l].description}</p>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* 3 · Message */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel>3 · Message</SectionLabel>
              <span className="text-[11px] text-ink-3">{message.length} / 500 · <button type="button" className="font-bold text-brand hover:underline" onClick={() => setCustomMessage(null)}>Reset template</button></span>
            </div>
            <textarea
              value={message}
              maxLength={500}
              rows={4}
              required
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full resize-y rounded-[14px] border border-line bg-surface p-3 text-[13.5px] leading-relaxed outline-none focus:border-brand"
            />
          </section>

          {/* 4 · Expiry */}
          <section className="space-y-2">
            <SectionLabel>4 · Valid for</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_OPTIONS.map((o) => (
                <button type="button" key={o.minutes} onClick={() => setExpiry(o.minutes)} className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${expiry === o.minutes ? 'border-brand bg-brand text-white' : 'border-line text-ink-2 hover:bg-elevated'}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-ink-3">Devices stop showing and relaying the alert after it expires, including over the offline mesh.</p>
          </section>

          {send.isError && <p className="rounded-[14px] bg-critical-bg px-3 py-2 text-[13px] text-critical" role="alert">{(send.error as Error).message}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <p className="text-[12px] text-ink-2">
              {needsApproval
                ? <>As {roleLabel(role ?? 'operator')}, this {level} alert will wait for an incident commander's approval before it is sent.</>
                : <>Sends to <strong className="text-ink">{devices}</strong> registered device{devices === 1 ? '' : 's'} as {session.data?.development ? 'the development operator' : session.data?.user.name}.</>}
            </p>
            {sentId ? (
              <Button type="button" variant="secondary" onClick={reset}>New alert</Button>
            ) : (
              <Button type="submit" variant={level === 'critical' ? 'danger' : 'primary'} disabled={!zone || !message.trim() || send.isPending}>
                <Send className="h-4 w-4" /> {send.isPending ? 'Sending…' : needsApproval ? 'Submit for approval' : `Send ${riskMeta[level].label.toLowerCase()} alert`}
              </Button>
            )}
          </div>
        </form>

        <div className="space-y-5">
          {/* Exactly what devices will show */}
          <div className="card p-5">
            <SectionLabel>Preview on Android</SectionLabel>
            <div className="mt-3 rounded-[22px] bg-gradient-to-b from-[#56705F] to-[#8FA595] p-4">
              <div className="rounded-[18px] bg-white/95 p-3.5 shadow-lg">
                <div className="flex items-center gap-2 text-[11px] text-ink-3"><Bell className="h-3.5 w-3.5 text-brand" /> LandGuard · now</div>
                <div className="mt-1.5 flex gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: riskMeta[level].accent }}><AlertTriangle className="h-4.5 w-4.5 text-white" /></div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-extrabold text-ink">{level.toUpperCase()} — {zone?.name ?? 'Select an area'}</p>
                    <p className="mt-0.5 line-clamp-4 text-[12.5px] text-ink-2">{message || '…'}</p>
                  </div>
                </div>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12px] text-ink-2">
              <li className="flex gap-2"><Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" /> Stored in the app's alert history with the same alert ID.</li>
              <li className="flex gap-2"><Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" /> Phones relay it over Nearby Connections to nearby LandGuard users who are offline (up to 6 hops, until expiry).</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" /> Devices confirm receipt back here when they are online.</li>
            </ul>
          </div>

          {sent && (
            <div className="card space-y-3 p-5" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityPill level={sent.level} />
                <AlertStatusPill status={sent.status} />
                <span className="ml-auto font-mono text-[11px] text-ink-3" title="Identical on the backend, FCM, Android and the mesh">ID {sent.alertId}</span>
              </div>
              <p className="text-[13px] font-bold text-ink">{sent.zoneName}</p>
              {sent.status === 'awaiting_approval' ? (
                <div className="space-y-2">
                  <p className="rounded-[14px] bg-sand px-3 py-2 text-[12.5px] text-ochre">Saved on the backend and waiting for an incident commander. It has not been sent to any device.</p>
                  {canApprove && <Button onClick={() => approve.mutate(sent.alertId)} disabled={approve.isPending}>Approve and send</Button>}
                </div>
              ) : (
                <DeliveryPanel alert={sent} />
              )}
              <button className="text-[12px] font-bold text-brand hover:underline" onClick={() => navigate(`/alerts?focus=${sent.alertId}`)}>Open in alert history</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
