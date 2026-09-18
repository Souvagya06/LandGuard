/**
 * Resolves the LandGuard API base URL.
 * - In local development or when served locally on localhost / 127.0.0.1:
 *   - If served by the backend (e.g. port 8000), it uses the current origin.
 *   - If served by Vite dev server (e.g. port 5173), it targets the local backend on port 8000.
 * - In production or custom environments:
 *   - Uses VITE_API_URL if defined, otherwise falls back to https://api.landguard.online.
 */
function resolveApiBase(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')

    if (isLocal) {
      // If served directly from the backend server (e.g., http://127.0.0.1:8000 or http://localhost:8000)
      if (port === '8000') {
        return window.location.origin
      }
      // If VITE_API_URL is explicitly set to a local target, respect it
      if (envUrl && !envUrl.includes('landguard.online')) {
        return envUrl
      }
      // Otherwise default to local backend on port 8000
      return `${protocol}//${hostname}:8000`
    }
  }

  return envUrl || 'https://api.landguard.online'
}

export const API_BASE = resolveApiBase().replace(/\/+$/, '')

export const WS_URL = `${API_BASE.replace(/^http/i, 'ws')}/`
