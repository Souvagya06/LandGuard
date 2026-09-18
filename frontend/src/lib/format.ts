export function timeAgo(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return '—'
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const future = diff < 0
  const mins = Math.round(Math.abs(diff) / 60000)
  let text: string
  if (mins < 1) return future ? 'in <1 min' : 'just now'
  if (mins < 60) text = `${mins} min`
  else if (mins < 60 * 24) text = `${Math.round(mins / 60)} h`
  else text = `${Math.round(mins / 1440)} d`
  return future ? `in ${text}` : `${text} ago`
}

const dateTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? dateTime.format(d) : '—'
}

export function formatDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? dateOnly.format(d) : '—'
}

export const mm = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value.toFixed(0)} mm`)

export const roleLabel = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
