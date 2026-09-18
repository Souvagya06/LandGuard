import type { ConditionsState } from '../types'
import type { RealtimeStatus } from './realtime'

/**
 * One freshness vocabulary for the whole control center (mirrored by the
 * Android app's "cached" labelling):
 *
 *  LIVE     backend reachable, realtime channel open, observations within their refresh window
 *  UPDATED  backend reachable and observations fresh, but received by periodic refresh (no realtime channel)
 *  CACHED   showing last known real data — the backend is unreachable, or its sources are older than the refresh window
 *  OFFLINE  backend unreachable and nothing loaded yet — no data is shown
 */
export type DataState = 'LIVE' | 'UPDATED' | 'CACHED' | 'OFFLINE'

export function computeDataState(input: { apiReachable: boolean; hasData: boolean; realtime: RealtimeStatus; conditions?: ConditionsState }): DataState {
  if (!input.apiReachable) return input.hasData ? 'CACHED' : 'OFFLINE'
  if (!input.hasData) return 'OFFLINE'
  if (input.conditions && input.conditions !== 'live') return 'CACHED'
  return input.realtime === 'open' ? 'LIVE' : 'UPDATED'
}

export const dataStateMeta: Record<DataState, { label: string; description: string; color: string; bg: string }> = {
  LIVE: { label: 'Live', description: 'Realtime channel connected; observations are within their refresh window.', color: '#16A34A', bg: '#F0FDF4' },
  UPDATED: { label: 'Updated', description: 'Observations are current; received by periodic refresh while the realtime channel reconnects.', color: '#1B5E37', bg: '#E8F5EE' },
  CACHED: { label: 'Cached', description: 'Showing the last known real data. It is older than the refresh window or the backend is unreachable.', color: '#D97706', bg: '#FFFBEB' },
  OFFLINE: { label: 'Offline', description: 'The LandGuard backend cannot be reached and no data has been loaded.', color: '#DC2626', bg: '#FEF2F2' },
}
