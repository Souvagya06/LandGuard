import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, Bell, FlaskConical, Camera, LogOut, Map, Menu, Send, Volume2, VolumeX, X } from 'lucide-react'
import { LandGuardWordmark } from './brand'
import { DataStateBadge, SeverityPill } from './ui'
import { subscribeFrames, useRealtimeBridge } from '../lib/realtime'
import { useConsoleDataState } from '../lib/queries'
import { fetchSession, readSession, signOut } from '../lib/api'
import { isAudioEnabled, playHazardAlertSound, playSonarPing, setAudioEnabled } from '../lib/audio'
import { roleLabel, timeAgo } from '../lib/format'
import type { PublicAlert } from '../types'

const NAV = [
  { to: '/', label: 'Live monitoring', icon: Map, end: true },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/send-alert', label: 'Send alert', icon: Send },
  { to: '/reports', label: 'Field reports', icon: Camera },
  { to: '/simulate', label: 'What-If studio', icon: FlaskConical },
  { to: '/system', label: 'System status', icon: Activity },
]

export default function Layout() {
  useRealtimeBridge()
  const navigate = useNavigate()
  const location = useLocation()
  const { state, zones, system } = useConsoleDataState()
  const session = useQuery({ queryKey: ['session'], queryFn: fetchSession, staleTime: 5 * 60_000 })
  const [audioOn, setAudioOn] = useState(() => isAudioEnabled())
  const [incoming, setIncoming] = useState<PublicAlert | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // New alerts arrive over the realtime channel exactly as devices receive them.
  useEffect(() => subscribeFrames((frame) => {
    if (frame.type !== 'alert') return
    const alert = frame.data as PublicAlert
    setIncoming(alert)
    playHazardAlertSound(alert.level)
  }), [])

  const conditions = zones.data?.conditions
  const activeAlerts = system.data?.alerts.active ?? 0
  const pending = system.data?.alerts.awaitingApproval ?? 0
  const user = session.data?.user ?? readSession()?.user
  const isMap = location.pathname === '/' || location.pathname.startsWith('/dashboard')

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
      isActive ? 'bg-brand text-white' : 'text-ink-2 hover:bg-elevated hover:text-ink'
    }`

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="px-2 pb-4 pt-2">
        <LandGuardWordmark subtitle="Control Center" />
      </div>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={navItem}>
          <Icon className="h-[18px] w-[18px]" />
          <span className="flex-1">{label}</span>
          {to === '/alerts' && activeAlerts + pending > 0 && (
            <span className="rounded-full bg-critical px-1.5 text-[11px] font-extrabold text-white">{activeAlerts + pending}</span>
          )}
        </NavLink>
      ))}
      <div className="mt-auto space-y-2 border-t border-divider pt-3">
        <button
          onClick={() => { const next = !audioOn; setAudioOn(next); setAudioEnabled(next); if (next) playSonarPing() }}
          className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-[13px] font-semibold text-ink-2 hover:bg-elevated"
        >
          {audioOn ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
          Alert sound {audioOn ? 'on' : 'off'}
        </button>
        {user && (
          <div className="flex items-center gap-2 rounded-[14px] bg-elevated px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/40 bg-brand-container text-[12px] font-extrabold text-brand">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-3">{session.data?.development ? 'Development session' : roleLabel(user.role)}</p>
            </div>
            {!session.data?.development && (
              <button onClick={() => { signOut(); navigate('/') }} title="Sign out" className="rounded-lg p-1.5 text-ink-3 hover:bg-surface hover:text-ink">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-[1500] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false) }}>{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1100] flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
          <button className="rounded-lg p-1.5 text-ink-2 hover:bg-elevated lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><LandGuardWordmark compact /></div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-[12px] text-ink-3 md:inline">
              {conditions?.observedAt ? `Conditions observed ${timeAgo(conditions.observedAt)} · ${zones.data?.zones.length ?? 0} monitored areas` : 'Waiting for monitoring data'}
            </span>
            {pending > 0 && (
              <button onClick={() => navigate('/alerts')} className="hidden rounded-full bg-sand px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-ochre sm:inline">
                {pending} awaiting approval
              </button>
            )}
            <DataStateBadge state={state} detail={conditions?.observedAt ? `Conditions observed ${timeAgo(conditions.observedAt)}` : undefined} />
          </div>
        </header>

        <main className={isMap ? 'flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6'}>
          <Outlet />
        </main>
      </div>

      {incoming && (
        <div className="toast-enter fixed right-4 top-16 z-[2000] w-[min(26rem,calc(100vw-2rem))] rounded-[20px] border border-line bg-surface p-4 shadow-[0_18px_50px_rgba(13,24,18,0.18)]" role="alert">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: incoming.level === 'critical' ? '#DC2626' : '#EA580C' }}>
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-ink-3">LandGuard · alert issued · {timeAgo(incoming.timestamp)}</p>
                <button onClick={() => setIncoming(null)} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-0.5 text-[14px] font-extrabold text-ink">{incoming.severity} — {incoming.zoneName}</p>
              <p className="mt-1 line-clamp-3 text-[12.5px] text-ink-2">{incoming.message}</p>
              <div className="mt-2 flex items-center gap-2">
                <SeverityPill level={incoming.level} />
                <button onClick={() => { setIncoming(null); navigate(`/alerts?focus=${incoming.alertId}`) }} className="text-[12px] font-bold text-brand hover:underline">
                  View delivery
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
