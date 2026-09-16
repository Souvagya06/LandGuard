import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveAlert, fetchAlerts } from '../lib/api'
import { riskMeta } from '../lib/risk'
import type { RiskLevel } from '../types'
import {
  Bell,
  Search,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Clock
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export default function Alerts() {
  const navigate = useNavigate()
  const [severityFilter, setSeverityFilter] = useState<'all' | RiskLevel>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 8000,
  })
  const approveMutation = useMutation({
    mutationFn: approveAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== 'all' && alert.level !== severityFilter) return false
    if (channelFilter !== 'all' && alert.channel !== channelFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        alert.zoneName.toLowerCase().includes(q) ||
        alert.message.toLowerCase().includes(q) ||
        alert.id.toLowerCase().includes(q)
      )
    }
    return true
  })

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  // Summary metrics
  const criticalCount = alerts.filter((a) => a.level === 'critical').length
  const highCount = alerts.filter((a) => a.level === 'high').length
  const deliveredPushCount = alerts.reduce(
    (acc, a) => acc + (a.delivery?.fcm?.delivered ?? (a.channel === 'push' ? 1 : 0)),
    0
  )

  return (
    <div className="space-y-6 dashboard-page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1f2b27] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
              <Bell className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Alert Broadcasts & Emergency Log
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#9bb0a6]">
            Audit history of every push notification, SMS dispatch, and automated hazard bulletin issued across North East India.
          </p>
        </div>

        <button
          onClick={() => navigate('/send-alert')}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:bg-red-500 transition-all"
        >
          <Send className="h-3.5 w-3.5" /> Dispatch New Emergency Warning
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">Total Alerts Dispatched</p>
          <p className="font-mono text-2xl font-bold text-[#f0f5f2] mt-1">{alerts.length}</p>
          <p className="text-[10px] text-[#596b63] mt-0.5">Persisted in AlertStore</p>
        </div>
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">Critical Evacuations</p>
          <p className="font-mono text-2xl font-bold text-red-400 mt-1">{criticalCount}</p>
          <p className="text-[10px] text-red-400/80 mt-0.5">Immediate danger notifications</p>
        </div>
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">Elevated High Warnings</p>
          <p className="font-mono text-2xl font-bold text-amber-400 mt-1">{highCount}</p>
          <p className="text-[10px] text-[#596b63] mt-0.5">High trigger probability</p>
        </div>
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">FCM Push Deliveries</p>
          <p className="font-mono text-2xl font-bold text-emerald-400 mt-1">{deliveredPushCount}</p>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">Direct device reach</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-[#1f2b27] bg-[#0d1211] px-3 py-1.5 w-full sm:w-72">
          <Search className="h-3.5 w-3.5 text-[#9bb0a6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts or settlement..."
            className="w-full bg-transparent text-xs text-[#f0f5f2] placeholder-[#596b63] focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[#596b63] text-[11px] mr-1">Severity:</span>
          {(['all', 'critical', 'high', 'moderate', 'low'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSeverityFilter(lvl)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                severityFilter === lvl
                  ? 'bg-emerald-500 text-[#070a09] font-bold'
                  : 'border border-[#1f2b27] bg-[#0d1211] text-[#9bb0a6] hover:text-[#f0f5f2]'
              }`}
            >
              {lvl.toUpperCase()}
            </button>
          ))}
          <span className="text-[#596b63] text-[11px] ml-2 mr-1">Channel:</span>
          {(['all', 'push', 'sms', 'dashboard', 'popup'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                channelFilter === ch
                  ? 'bg-cyan-500 text-[#070a09] font-bold'
                  : 'border border-[#1f2b27] bg-[#0d1211] text-[#9bb0a6] hover:text-[#f0f5f2]'
              }`}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      {isError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300">
          Unable to synchronize live alert repository. Backend connection unavailable.
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#9bb0a6]">Loading alert audit trail...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center border border-[#1f2b27] space-y-3">
          <Bell className="h-10 w-10 text-[#2c3e38] mx-auto" />
          <p className="text-sm font-medium text-[#f0f5f2]">No alerts match selected filters</p>
          <p className="text-xs text-[#9bb0a6]">All monitored slopes are currently operating within baseline advisory levels.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const meta = riskMeta[alert.level]
            const isCritical = alert.level === 'critical'
            const isCopied = copiedId === alert.id

            return (
              <div
                key={alert.id}
                className={`glass-panel rounded-xl p-4 border transition-all ${
                  isCritical
                    ? 'border-red-500/40 bg-red-950/10 hover:border-red-500/70 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                    : 'border-[#1f2b27] hover:border-[#2c3e38]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${meta.dot} ${isCritical ? 'animate-ping' : ''}`} />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#f0f5f2]">{alert.zoneName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text}`}>
                          {meta.label.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] text-[#596b63] border border-[#1f2b27] rounded px-1.5 py-0.5">
                          {alert.channel.toUpperCase()}
                        </span>
                        {alert.status === 'awaiting_approval' && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            AWAITING COMMAND APPROVAL
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#c2d1cb] leading-relaxed max-w-3xl font-sans">
                        {alert.message}
                      </p>

                      {/* FCM delivery telemetry */}
                      {alert.delivery && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-[#596b63]">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Status: {alert.delivery.status}
                          </span>
                          {alert.delivery.fcm && (
                            <span>
                              (Delivered: {alert.delivery.fcm.delivered}/{alert.delivery.fcm.attempted})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2 font-mono text-xs">
                    <span className="text-[#596b63] flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(alert.createdAt)}
                    </span>
                    <button
                      onClick={() => copyMessage(alert.id, alert.message)}
                      className="flex items-center gap-1 rounded border border-[#1f2b27] bg-[#090d0c] px-2 py-1 text-[11px] text-[#9bb0a6] hover:text-white transition-colors"
                      title="Copy broadcast text"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {isCopied ? 'Copied' : 'Copy'}
                    </button>
                    {alert.status === 'awaiting_approval' && (
                      <button
                        onClick={() => approveMutation.mutate(alert.id)}
                        disabled={approveMutation.isPending}
                        className="rounded bg-amber-500 px-2 py-1 text-[11px] font-bold text-[#070a09] disabled:opacity-50"
                      >
                        {approveMutation.isPending ? 'Approving…' : 'Approve & dispatch'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
