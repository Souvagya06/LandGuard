import { useQuery } from '@tanstack/react-query'
import { fetchAuthorityAlerts, fetchMonitoringZones, fetchSystemStatus } from './api'
import { computeDataState } from './dataState'
import { useRealtimeStatus } from './realtime'

// Realtime pushes invalidate these; the intervals are only a safety net.
export const useMonitoringZones = () =>
  useQuery({ queryKey: ['monitoring', 'zones'], queryFn: fetchMonitoringZones, refetchInterval: 5 * 60_000 })

export const useSystemStatus = () =>
  useQuery({ queryKey: ['system'], queryFn: fetchSystemStatus, refetchInterval: 30_000 })

export const useAuthorityAlerts = () =>
  useQuery({ queryKey: ['alerts', 'authority'], queryFn: fetchAuthorityAlerts, refetchInterval: 60_000 })

/** Freshness of what the operator is looking at right now. */
export function useConsoleDataState() {
  const realtime = useRealtimeStatus()
  const zones = useMonitoringZones()
  const system = useSystemStatus()
  const apiReachable = !(zones.isError && system.isError)
  const state = computeDataState({
    apiReachable,
    hasData: Boolean(zones.data?.zones.length),
    realtime,
    conditions: zones.data?.conditions.state,
  })
  return { state, realtime, zones, system }
}
