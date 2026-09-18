import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WS_URL } from './config'

export type RealtimeStatus = 'connecting' | 'open' | 'closed'

export interface RealtimeFrame<T = unknown> {
  type: string
  data: T
  timestamp: string
}

type Listener = (frame: RealtimeFrame) => void

let socket: WebSocket | null = null
let status: RealtimeStatus = 'closed'
let lastFrameAt: number | null = null
let retry = 0
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let pingTimer: ReturnType<typeof setInterval> | undefined
let consumers = 0
const statusListeners = new Set<() => void>()
const frameListeners = new Set<Listener>()

function setStatus(next: RealtimeStatus) {
  status = next
  statusListeners.forEach((fn) => fn())
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
  setStatus('connecting')
  const ws = new WebSocket(WS_URL)
  socket = ws
  ws.onopen = () => {
    retry = 0
    setStatus('open')
    clearInterval(pingTimer)
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
    }, 25_000)
  }
  ws.onmessage = (event) => {
    try {
      const frame = JSON.parse(event.data) as RealtimeFrame
      lastFrameAt = Date.now()
      frameListeners.forEach((fn) => fn(frame))
    } catch {
      /* ignore malformed frames */
    }
  }
  ws.onclose = () => {
    clearInterval(pingTimer)
    socket = null
    setStatus('closed')
    if (consumers > 0) {
      // Exponential backoff, 1 s → 30 s.
      const delay = Math.min(30_000, 1000 * 2 ** retry++)
      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(connect, delay)
    }
  }
  ws.onerror = () => ws.close()
}

export function subscribeFrames(listener: Listener): () => void {
  frameListeners.add(listener)
  return () => frameListeners.delete(listener)
}

export function useRealtimeStatus() {
  return useSyncExternalStore(
    (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn) },
    () => status,
  )
}

export const lastRealtimeFrameAt = () => lastFrameAt

/**
 * Keeps one socket open while the console is mounted and turns backend
 * events into cache invalidations, so every screen updates without a refresh.
 */
export function useRealtimeBridge() {
  const queryClient = useQueryClient()
  useEffect(() => {
    consumers += 1
    connect()
    const onOnline = () => connect()
    window.addEventListener('online', onOnline)
    const unsubscribe = subscribeFrames((frame) => {
      if (frame.type.startsWith('alert')) {
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['system'] })
      } else if (frame.type.startsWith('monitoring')) {
        queryClient.invalidateQueries({ queryKey: ['monitoring'] })
        queryClient.invalidateQueries({ queryKey: ['system'] })
      } else if (frame.type.startsWith('report.')) {
        queryClient.invalidateQueries({ queryKey: ['reports'] })
      }
    })
    return () => {
      consumers -= 1
      unsubscribe()
      window.removeEventListener('online', onOnline)
      if (consumers === 0) {
        clearTimeout(reconnectTimer)
        socket?.close()
      }
    }
  }, [queryClient])
}
