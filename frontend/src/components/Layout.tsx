import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAlertWebSocket } from '../lib/websocket'
import { isAudioEnabled, setAudioEnabled, playSonarPing } from '../lib/audio'
import SystemTelemetryModal from './SystemTelemetryModal'
import {
  Volume2,
  VolumeX,
  Server,
  Bell,
  Map,
  Zap,
  Camera,
  Send,
  Info,
  X,
  AlertTriangle
} from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()
  const { status: wsStatus, latencyMs, lastAlert, clientId, dismissAlert } = useAlertWebSocket()

  const [audioActive, setAudioActive] = useState<boolean>(true)
  const [telemetryOpen, setTelemetryOpen] = useState(false)

  useEffect(() => {
    setAudioActive(isAudioEnabled())
  }, [])

  const toggleAudio = () => {
    const next = !audioActive
    setAudioActive(next)
    setAudioEnabled(next)
    if (next) playSonarPing()
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
        : 'text-[#9bb0a6] hover:text-[#f0f5f2] hover:bg-[#131a18] border border-transparent'
    }`

  return (
    <div className="app-shell min-h-screen bg-[#070a09] text-[#f0f5f2]">
      {/* Top Tactical Command Header */}
      <header className="sticky top-0 z-40 border-b border-[#1f2b27] bg-[#070a09]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Brand & Mission Status */}
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/60 bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] group-hover:bg-emerald-500/20 transition-all">
                LG
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold leading-tight text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    LandGuard AI
                  </p>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 border border-emerald-500/40">
                    NER-CORE
                  </span>
                </div>
                <p className="text-[10px] text-[#596b63] leading-tight">Landslide Early Warning & InSAR Intelligence</p>
              </div>
            </NavLink>
          </div>

          {/* Navigation Bar */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" className={navLinkClass}>
              <Map className="h-3.5 w-3.5" /> Operations Map
            </NavLink>
            <NavLink to="/simulate" className={navLinkClass}>
              <Zap className="h-3.5 w-3.5" /> What-If Studio
            </NavLink>
            <NavLink to="/alerts" className={navLinkClass}>
              <Bell className="h-3.5 w-3.5" /> Alerts Log
            </NavLink>
            <NavLink to="/send-alert" className={navLinkClass}>
              <Send className="h-3.5 w-3.5" /> Dispatch Alert
            </NavLink>
            <NavLink to="/reports" className={navLinkClass}>
              <Camera className="h-3.5 w-3.5" /> Ground Truth
            </NavLink>
            <a
              href="/about.html"
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-[#9bb0a6] hover:text-[#f0f5f2] hover:bg-[#131a18] border border-transparent transition-colors"
            >
              <Info className="h-3.5 w-3.5" /> Architecture
            </a>
          </nav>

          {/* Right Action Tools: WebSocket status, Audio Siren, Telemetry */}
          <div className="flex items-center gap-2">
            {/* Real-Time WebSocket Heartbeat */}
            <button
              onClick={() => setTelemetryOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#1f2b27] bg-[#0d1211] px-2.5 py-1.5 text-[11px] text-[#9bb0a6] hover:border-emerald-500/40 hover:text-[#f0f5f2] transition-colors"
              title="Click to view Backend & ML Architecture Telemetry"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                    : wsStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="font-mono text-[10px] hidden sm:inline uppercase">
                {wsStatus === 'connected' ? `WS LIVE (${latencyMs ?? 12}ms)` : wsStatus}
              </span>
            </button>

            {/* Audio Alarm Sound Toggle */}
            <button
              onClick={toggleAudio}
              className={`rounded-lg border p-1.5 transition-colors ${
                audioActive
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-[#1f2b27] bg-[#0d1211] text-[#596b63] hover:text-[#9bb0a6]'
              }`}
              title={audioActive ? 'Audio Hazard Alarms Active (Click to mute)' : 'Audio Muted (Click to enable)'}
            >
              {audioActive ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* System Diagnostics Modal Trigger */}
            <button
              onClick={() => setTelemetryOpen(true)}
              className="rounded-lg border border-[#1f2b27] bg-[#0d1211] p-1.5 text-[#9bb0a6] hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
              title="System Architecture Diagnostics"
            >
              <Server className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around border-t border-[#1f2b27] px-2 py-1.5 bg-[#0a0d0c] overflow-x-auto text-[11px]">
          <NavLink to="/dashboard" className="p-1 text-[#9bb0a6] hover:text-white">Map</NavLink>
          <NavLink to="/simulate" className="p-1 text-[#9bb0a6] hover:text-white">Simulator</NavLink>
          <NavLink to="/alerts" className="p-1 text-[#9bb0a6] hover:text-white">Alerts</NavLink>
          <NavLink to="/send-alert" className="p-1 text-[#9bb0a6] hover:text-white">Dispatch</NavLink>
          <NavLink to="/reports" className="p-1 text-[#9bb0a6] hover:text-white">Reports</NavLink>
        </div>
      </header>

      {/* Slide-in Live Emergency Toast Notification */}
      {lastAlert && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md animate-bounce rounded-xl border border-red-500/50 bg-red-950/90 p-4 text-white shadow-2xl backdrop-blur-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-red-200">{lastAlert.zoneName}</p>
                  <span className="rounded bg-red-500 px-1.5 py-0.2 font-mono text-[9px] font-extrabold uppercase text-black">
                    {lastAlert.level}
                  </span>
                </div>
                <p className="text-xs text-red-100/90 mt-1 leading-relaxed">{lastAlert.message}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      dismissAlert()
                      navigate('/alerts')
                    }}
                    className="rounded bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500"
                  >
                    View in Alerts Log
                  </button>
                  <button
                    onClick={dismissAlert}
                    className="text-xs text-red-300 hover:text-white px-2 py-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            <button onClick={dismissAlert} className="text-red-300 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main App Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      {/* System Telemetry & ML Architecture Modal */}
      <SystemTelemetryModal
        isOpen={telemetryOpen}
        onClose={() => setTelemetryOpen(false)}
        wsStatus={wsStatus}
        wsLatency={latencyMs}
        clientId={clientId}
      />
    </div>
  )
}