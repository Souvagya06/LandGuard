import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHealth, fetchDevices, API_BASE } from '../lib/api'
import { Server, Cpu, Database, Smartphone, Activity, Radio, X, RefreshCw, ShieldCheck } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  wsStatus: string
  wsLatency: number | null
  clientId: string | null
}

export default function SystemTelemetryModal({ isOpen, onClose, wsStatus, wsLatency, clientId }: Props) {
  const [pingLatency, setPingLatency] = useState<number | null>(null)
  const [isPinging, setIsPinging] = useState(false)

  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    enabled: isOpen,
  })

  const { data: devices, isLoading: devicesLoading, refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    enabled: isOpen,
  })

  const testPing = async () => {
    setIsPinging(true)
    const start = performance.now()
    try {
      await fetch(`${API_BASE}/health`, { cache: 'no-store' })
      setPingLatency(Math.round(performance.now() - start))
    } catch {
      setPingLatency(null)
    } finally {
      setIsPinging(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      testPing()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel relative w-full max-w-2xl rounded-xl border border-[#2c3e38] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2b27] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                System Architecture & ML Telemetry
              </h2>
              <p className="text-xs text-[#9bb0a6]">Real-time operational status of backend services and inference engines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#1f2b27] p-1.5 text-[#9bb0a6] hover:border-emerald-500/50 hover:bg-[#131a18] hover:text-[#f0f5f2] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Network & Socket Diagnostics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#1f2b27] bg-[#0d1211] p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#9bb0a6]">
              <span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-emerald-400" /> WebSocket Sync</span>
              <span className={`h-2 w-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`} />
            </div>
            <p className="font-mono text-sm font-semibold capitalize text-[#f0f5f2]">{wsStatus}</p>
            <p className="text-[10px] text-[#596b63] truncate">ID: {clientId || 'Initializing...'}</p>
          </div>

          <div className="rounded-lg border border-[#1f2b27] bg-[#0d1211] p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#9bb0a6]">
              <span className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-cyan-400" /> API Roundtrip</span>
              <button
                onClick={testPing}
                disabled={isPinging}
                className="text-[#9bb0a6] hover:text-cyan-400 transition-colors"
                title="Refresh latency"
              >
                <RefreshCw className={`h-3 w-3 ${isPinging ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="font-mono text-sm font-semibold text-cyan-400">
              {pingLatency !== null ? `${pingLatency} ms` : wsLatency !== null ? `${wsLatency} ms` : 'Testing…'}
            </p>
            <p className="text-[10px] text-[#596b63]">HTTP / Express Latency</p>
          </div>

          <div className="rounded-lg border border-[#1f2b27] bg-[#0d1211] p-3.5 space-y-1 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs text-[#9bb0a6]">
              <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-amber-400" /> Field Devices</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="font-mono text-sm font-semibold text-amber-400">
              {devicesLoading ? '…' : `${devices?.registeredDevices ?? 0} Connected`}
            </p>
            <p className="text-[10px] text-[#596b63]">{devices?.androidDevices ?? 0} Android FCM Targets</p>
          </div>
        </div>

        {/* Backend ML Engine Details */}
        <div className="rounded-lg border border-[#1f2b27] bg-[#0d1211] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-[#f0f5f2]">
              <Cpu className="h-4 w-4 text-emerald-400" /> Dual-Agent Machine Learning Core
            </h3>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
              v{health?.version || '2.2.0'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-[#1a2420] bg-[#111715] p-3 space-y-1">
              <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider">Agent A (Geomorphology)</p>
              <p className="font-medium text-[#f0f5f2]">Terrain Susceptibility Classifier</p>
              <p className="text-[11px] text-[#9bb0a6]">
                Evaluates static spatial topography: slope gradient, aspect, elevation, and historical landslide inventory.
              </p>
            </div>
            <div className="rounded border border-[#1a2420] bg-[#111715] p-3 space-y-1">
              <p className="font-mono text-[10px] text-amber-400 uppercase tracking-wider">Agent B (Meteorological & Radar)</p>
              <p className="font-medium text-[#f0f5f2]">Dynamic Rain & InSAR Trigger Engine</p>
              <p className="text-[11px] text-[#9bb0a6]">
                Synthesizes trailing 24h/7d Open-Meteo precipitation, API index, and Sentinel-1 InSAR surface deformation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a2420] text-xs text-[#9bb0a6]">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-[#596b63]" /> Spatial Source:
              <span className="font-mono text-[#f0f5f2]">{health?.spatialFeatureSource || 'ml/data/processed/feature_table.csv'}</span>
            </span>
            <span className="font-mono text-emerald-400">
              {health?.monitoringLocations || 19} Monitored Coordinates
            </span>
          </div>
        </div>

        {/* Runtime & Environment */}
        <div className="rounded-lg border border-[#1f2b27] bg-[#0d1211] p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#9bb0a6]">API Runtime Platform:</span>
            <span className="font-mono font-medium text-[#f0f5f2]">{health?.runtime || 'Node.js Express + Dual-Agent ML'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9bb0a6]">API Base Endpoint:</span>
            <span className="font-mono text-emerald-400">{API_BASE}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9bb0a6]">Weather Integration:</span>
            <span className="font-mono text-[#f0f5f2]">Open-Meteo Multi-Coordinate Batch (10m TTL)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9bb0a6]">Push Notification Channel:</span>
            <span className="font-mono text-amber-400">Firebase Cloud Messaging (FCM HTTP v1) + WebSocket</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => {
              refetchHealth()
              refetchDevices()
              testPing()
            }}
            className="flex items-center gap-2 rounded-lg border border-[#1f2b27] bg-[#131a18] px-4 py-2 text-xs font-medium text-[#f0f5f2] hover:border-emerald-500/50 hover:bg-[#1a2421] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Diagnostics
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-[#070a09] hover:bg-emerald-400 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  )
}
