import { CheckCircle2, Radio, Smartphone, Wifi } from 'lucide-react'
import type { AlertRecord } from '../types'
import { deliveryTone, describeCode, describeReason, toneStyle } from '../lib/delivery'
import { formatDateTime, timeAgo } from '../lib/format'
import { MetricTile } from './ui'

/**
 * What actually happened to an alert: the FCM multicast result, then device
 * receipts (FCM, sync after reconnect, or relayed over the Nearby mesh).
 */
export default function DeliveryPanel({ alert }: { alert: AlertRecord }) {
  const tone = deliveryTone(alert)
  const style = toneStyle[tone]
  const fcm = alert.delivery.fcm
  const r = alert.receipts

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-[14px] px-3 py-2" style={{ background: style.bg, color: style.color }}>
        <CheckCircle2 className="h-4 w-4" />
        <p className="text-[12.5px] font-bold">{style.label}{alert.delivery.attemptedAt ? ` · ${formatDateTime(alert.delivery.attemptedAt)}` : ''}</p>
      </div>
      {fcm?.reason && <p className="text-[12px] text-ink-2">{describeReason(fcm.reason)}</p>}

      {fcm && (
        <div className="grid grid-cols-4 gap-1.5">
          <MetricTile value={fcm.attempted} label="Devices targeted" />
          <MetricTile value={fcm.accepted} label="Accepted by FCM" accent={fcm.accepted ? '#16A34A' : undefined} />
          <MetricTile value={fcm.failed} label="Failed" accent={fcm.failed ? '#DC2626' : undefined} />
          <MetricTile value={fcm.invalidTokensRemoved} label="Stale tokens removed" />
        </div>
      )}
      {fcm && Object.keys(fcm.failures || {}).length > 0 && (
        <ul className="space-y-0.5 text-[11.5px] text-ink-2">
          {Object.entries(fcm.failures).map(([code, n]) => <li key={code}>{n} × {describeCode(code)}</li>)}
        </ul>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Confirmed on devices</p>
        <div className="grid grid-cols-3 gap-1.5">
          <MetricTile value={r.received} label="Received" accent={r.received ? '#1B5E37' : undefined} />
          <MetricTile value={r.opened} label="Opened" />
          <MetricTile value={r.acknowledged} label="Acknowledged" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-ink-2"><Smartphone className="h-3 w-3" /> FCM {r.via.fcm ?? 0}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-ink-2"><Wifi className="h-3 w-3" /> Sync after reconnect {r.via.sync ?? 0}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-ink-2"><Radio className="h-3 w-3" /> Offline mesh {r.via.mesh ?? 0}{r.maxHopCount ? ` · up to ${r.maxHopCount} hop${r.maxHopCount === 1 ? '' : 's'}` : ''}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">
          {r.lastReceiptAt ? `Last confirmation ${timeAgo(r.lastReceiptAt)}.` : 'No device has confirmed receipt yet.'} Devices that were offline confirm when they reconnect.
        </p>
      </div>
    </div>
  )
}
