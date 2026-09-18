import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { AlertStatus, RiskLevel } from '../types'
import { riskMeta } from '../lib/risk'
import { dataStateMeta, type DataState } from '../lib/dataState'

/** Android `SeverityPill`: uppercase label on the level container, 8px radius. */
export function SeverityPill({ level, className = '' }: { level: RiskLevel; className?: string }) {
  const meta = riskMeta[level]
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.08em] ${className}`}
      style={{ color: meta.accent, background: meta.container, borderColor: `${meta.accent}40` }}
    >
      {meta.label}
    </span>
  )
}

/** Android `SeverityDot`: pulses for high and critical. */
export function SeverityDot({ level, size = 10 }: { level: RiskLevel; size?: number }) {
  const pulsing = level === 'high' || level === 'critical'
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${pulsing ? 'dot-pulse' : ''}`}
      style={{ width: size, height: size, background: riskMeta[level].accent, color: riskMeta[level].accent }}
    />
  )
}

/** Android `MetricTile`. */
export function MetricTile({ value, label, accent, hint }: { value: ReactNode; label: string; accent?: string; hint?: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-elevated px-3 py-2.5" title={hint}>
      <p className="truncate text-[17px] font-extrabold leading-tight" style={{ color: accent ?? '#0D1812' }}>{value}</p>
      <p className="truncate text-[10.5px] font-medium text-ink-3">{label}</p>
    </div>
  )
}

export function DataStateBadge({ state, detail }: { state: DataState; detail?: string }) {
  const meta = dataStateMeta[state]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]"
      style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}33` }}
      title={`${meta.description}${detail ? `\n${detail}` : ''}`}
    >
      <span className={`h-2 w-2 rounded-full ${state === 'LIVE' ? 'dot-pulse' : ''}`} style={{ background: meta.color, color: meta.color }} />
      {meta.label}
    </span>
  )
}

const statusStyle: Record<AlertStatus, { label: string; color: string; bg: string }> = {
  awaiting_approval: { label: 'Awaiting approval', color: '#C98A1E', bg: '#F4EEE1' },
  active: { label: 'Active', color: '#1B5E37', bg: '#E8F5EE' },
  cancelled: { label: 'Cancelled', color: '#4A6558', bg: '#F2F5F3' },
  expired: { label: 'Expired', color: '#8AA898', bg: '#F2F5F3' },
}

export function AlertStatusPill({ status }: { status: AlertStatus }) {
  const s = statusStyle[status]
  return (
    <span className="inline-flex items-center rounded-lg px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-white hover:bg-brand-dark border-brand',
    secondary: 'bg-surface text-brand border-brand/40 hover:bg-brand-container',
    danger: 'bg-critical text-white hover:bg-[#B91C1C] border-critical',
    ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-elevated',
  }
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[14px] border px-4 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Android `MoreSection` label style. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">{children}</p>
}

export function Unavailable({ reason, compact = false }: { reason: string; compact?: boolean }) {
  return (
    <div className={`rounded-[14px] border border-dashed border-line bg-elevated ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">Data unavailable</p>
      <p className="mt-0.5 text-[12px] text-ink-3">{reason}</p>
    </div>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="w-32 shrink-0 text-[12px] text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-right text-[13px] font-medium text-ink">{children}</span>
    </div>
  )
}
