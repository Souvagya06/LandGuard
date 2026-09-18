import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Search, Send } from 'lucide-react'
import { approveAlert, cancelAlert, fetchSession } from '../lib/api'
import { useAuthorityAlerts } from '../lib/queries'
import { RISK_LEVELS, riskMeta } from '../lib/risk'
import { deliveryTone, toneStyle } from '../lib/delivery'
import { formatDateTime, timeAgo } from '../lib/format'
import type { AlertRecord, AlertStatus, RiskLevel } from '../types'
import { AlertStatusPill, Button, MetricTile, PageHeader, Row, SeverityDot, SeverityPill } from '../components/ui'
import DeliveryPanel from '../components/DeliveryPanel'

const STATUS_FILTERS: { value: 'all' | AlertStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
]

function AlertCard({ alert, open, onToggle, canApprove }: { alert: AlertRecord; open: boolean; onToggle: () => void; canApprove: boolean }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
  const approve = useMutation({ mutationFn: () => approveAlert(alert.alertId), onSuccess: invalidate })
  const cancel = useMutation({ mutationFn: () => cancelAlert(alert.alertId), onSuccess: invalidate })
  const tone = toneStyle[deliveryTone(alert)]
  const error = (approve.error || cancel.error) as Error | null

  return (
    <div id={`alert-${alert.alertId}`} className={`card overflow-hidden ${open ? 'ring-1 ring-brand/30' : ''}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left hover:bg-elevated/50" aria-expanded={open}>
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: riskMeta[alert.level].container }}>
          <SeverityDot level={alert.level} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityPill level={alert.level} />
            <AlertStatusPill status={alert.status} />
            <span className="rounded-lg px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: tone.color, background: tone.bg }}>{tone.label}</span>
          </div>
          <p className="mt-1.5 text-[14px] font-bold text-ink">{alert.zoneName}</p>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{alert.message}</p>
          <p className="mt-1 text-[11px] text-ink-3">
            Issued {timeAgo(alert.timestamp)} · {alert.receipts.received} device{alert.receipts.received === 1 ? '' : 's'} confirmed
            {alert.delivery.fcm ? ` · FCM ${alert.delivery.fcm.accepted}/${alert.delivery.fcm.attempted}` : ''}
          </p>
        </div>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-divider p-4 lg:grid-cols-2">
          <div>
            <p className="text-[13px] leading-relaxed text-ink">{alert.message}</p>
            <div className="mt-3 divide-y divide-divider">
              <Row label="Alert ID"><span className="font-mono text-[11.5px]">{alert.alertId}</span></Row>
              <Row label="Area">{alert.zoneName} <span className="text-ink-3">({alert.zoneId})</span></Row>
              <Row label="Issued">{formatDateTime(alert.timestamp)}</Row>
              <Row label="Expires">{formatDateTime(alert.expiresAt)} ({timeAgo(alert.expiresAt)})</Row>
              <Row label="Source / origin">{alert.source === 'authority' ? 'LandGuard Authority' : 'Risk engine'} · {alert.origin === 'authority_web' ? 'Control center' : 'API'}</Row>
              <Row label="Created by">{alert.createdBy?.name ?? '—'}</Row>
              <Row label="Approved by">{alert.approvedBy ? `${alert.approvedBy.name} · ${formatDateTime(alert.approvedAt)}` : '—'}</Row>
              {alert.cancelledBy && <Row label="Cancelled by">{alert.cancelledBy.name} · {formatDateTime(alert.cancelledAt)}</Row>}
              {alert.riskSnapshot && <Row label="Area risk at issue">{alert.riskSnapshot.score}/100 · {riskMeta[alert.riskSnapshot.level].label}</Row>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {alert.status === 'awaiting_approval' && canApprove && <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve and send</Button>}
              {(alert.status === 'active' || alert.status === 'awaiting_approval') && (
                <Button variant="secondary" onClick={() => { if (window.confirm('Cancel this alert on all devices?')) cancel.mutate() }} disabled={cancel.isPending}>Cancel alert</Button>
              )}
              <Button variant="ghost" onClick={() => navigate(`/?zone=${encodeURIComponent(alert.zoneId)}`)}>Show on map</Button>
            </div>
            {error && <p className="mt-2 text-[12px] text-critical">{error.message}</p>}
          </div>
          {alert.status === 'awaiting_approval'
            ? <p className="self-start rounded-[14px] bg-sand px-3 py-2 text-[12.5px] text-ochre">Not sent to any device until an incident commander approves it.</p>
            : <DeliveryPanel alert={alert} />}
        </div>
      )}
    </div>
  )
}

export default function Alerts() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get('focus'))
  const [level, setLevel] = useState<'all' | RiskLevel>('all')
  const [status, setStatus] = useState<'all' | AlertStatus>('all')
  const [search, setSearch] = useState('')
  const alerts = useAuthorityAlerts()
  const session = useQuery({ queryKey: ['session'], queryFn: fetchSession, staleTime: 5 * 60_000 })
  const canApprove = session.data?.user.role === 'incident_commander' || session.data?.user.role === 'admin'

  const all = useMemo(() => alerts.data ?? [], [alerts.data])
  const q = search.trim().toLowerCase()
  const shown = all.filter((a) =>
    (level === 'all' || a.level === level) &&
    (status === 'all' || a.status === status) &&
    (!q || a.zoneName.toLowerCase().includes(q) || a.message.toLowerCase().includes(q) || a.alertId.includes(q)))

  const confirmed = all.reduce((sum, a) => sum + a.receipts.received, 0)

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Alerts"
        subtitle="Every alert issued to LandGuard devices, with what Firebase accepted and what devices confirmed."
        actions={<Button onClick={() => navigate('/send-alert')}><Send className="h-4 w-4" /> Send alert</Button>}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile value={all.filter((a) => a.status === 'active').length} label="Active now" accent="#1B5E37" />
        <MetricTile value={all.filter((a) => a.status === 'awaiting_approval').length} label="Awaiting approval" accent="#C98A1E" />
        <MetricTile value={all.filter((a) => a.level === 'critical').length} label="Critical issued" accent="#DC2626" />
        <MetricTile value={confirmed} label="Device confirmations" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-[14px] border border-line bg-surface px-3 py-2">
          <Search className="h-4 w-4 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search area, message or alert ID" className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-3" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setLevel('all')} className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${level === 'all' ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2'}`}>All</button>
          {RISK_LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
              style={level === l ? { background: riskMeta[l].accent, borderColor: riskMeta[l].accent, color: '#fff' } : { background: riskMeta[l].container, borderColor: `${riskMeta[l].accent}40`, color: riskMeta[l].accent }}>
              {riskMeta[l].label}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-[14px] border border-line bg-surface px-3 py-2 text-[13px]">
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {alerts.isLoading && <p className="text-[13px] text-ink-3">Loading alerts…</p>}
      {alerts.isError && <p className="rounded-[14px] bg-critical-bg px-3 py-2 text-[13px] text-critical">Alert history is unavailable: {(alerts.error as Error).message}</p>}
      {!alerts.isLoading && !alerts.isError && shown.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[15px] font-bold text-ink">{all.length ? 'No alerts match these filters' : 'No alerts have been issued yet'}</p>
          <p className="mt-1 text-[13px] text-ink-2">Alerts sent from this console appear here with their delivery results.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {shown.map((a) => <AlertCard key={a.alertId} alert={a} open={openId === a.alertId} onToggle={() => setOpenId(openId === a.alertId ? null : a.alertId)} canApprove={canApprove} />)}
      </div>
    </div>
  )
}
