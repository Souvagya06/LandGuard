import { useEffect, useState, useRef, useCallback } from 'react'
import { API_BASE } from './api'
import type { AlertItem, WebSocketAlertMessage } from '../types'
import { playHazardAlertSound } from './audio'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export interface WebSocketState {
  status: ConnectionStatus
  latencyMs: number | null
  lastAlert: AlertItem | null
  clientId: string | null
}

type AlertListener = (alert: AlertItem) => void
const alertListeners = new Set<AlertListener>()

export function subscribeToAlerts(listener: AlertListener): () => void {
  alertListeners.add(listener)
  return () => {
    alertListeners.delete(listener)
  }
}

let globalWs: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let pingSentAt = 0

export function useAlertWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [lastAlert, setLastAlert] = useState<AlertItem | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return
    if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
      return
    }

    const wsUrl = API_BASE.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
    setStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      globalWs = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setStatus('connected')
        // Send initial ping to check latency
        pingSentAt = Date.now()
        ws.send(JSON.stringify({ type: 'ping' }))

        // Recurring heartbeat ping every 25 seconds
        if (pingTimer) clearInterval(pingTimer)
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingSentAt = Date.now()
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25000)
      }

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketAlertMessage = JSON.parse(event.data)
          if (msg.type === 'pong') {
            const lat = Date.now() - pingSentAt
            if (mountedRef.current) setLatencyMs(lat)
          } else if (msg.type === 'connection' && msg.clientId) {
            if (mountedRef.current) setClientId(msg.clientId)
          } else if (msg.type === 'alert' && msg.data) {
            const incoming = msg.data
            if (mountedRef.current) setLastAlert(incoming)
            // Play hazard alert tone
            playHazardAlertSound(incoming.level)
            // Notify all registered listeners
            alertListeners.forEach((fn) => {
              try {
                fn(incoming)
              } catch (e) {
                console.error('[WebSocket] Error in alert listener:', e)
              }
            })
          }
        } catch (err) {
          console.debug('[WebSocket] Error parsing WS payload:', err)
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setStatus('disconnected')
        setLatencyMs(null)
        if (pingTimer) clearInterval(pingTimer)
        // Auto-reconnect after 4 seconds
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => {
          if (mountedRef.current) connect()
        }, 4000)
      }

      ws.onerror = () => {
        // Handled via onclose
      }
    } catch {
      setStatus('disconnected')
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        if (mountedRef.current) connect()
      }, 5000)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()

    const unsubscribe = subscribeToAlerts((alert) => {
      if (mountedRef.current) setLastAlert(alert)
    })

    return () => {
      mountedRef.current = false
      unsubscribe()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pingTimer) clearInterval(pingTimer)
    }
  }, [connect])

  return {
    status,
    latencyMs,
    lastAlert,
    clientId,
    dismissAlert: () => setLastAlert(null),
  }
}
