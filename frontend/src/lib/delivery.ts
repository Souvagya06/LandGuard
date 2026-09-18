import type { AlertRecord } from '../types'

const REASONS: Record<string, string> = {
  firebase_not_configured: 'Push delivery is not configured on the server (Firebase Admin credentials are missing).',
  firebase_credentials_unreadable: 'The Firebase Admin credentials on the server could not be read.',
  no_registered_devices: 'No LandGuard devices are registered yet, so there was nobody to deliver to.',
  all_deliveries_failed: 'Firebase rejected every delivery — see the failure codes.',
  firebase_delivery_error: 'The request to Firebase failed. Delivery was not confirmed.',
}

const CODES: Record<string, string> = {
  'messaging/registration-token-not-registered': 'app uninstalled / token expired (removed)',
  'messaging/invalid-registration-token': 'invalid token (removed)',
  'messaging/unavailable': 'FCM temporarily unavailable',
  'messaging/internal-error': 'FCM internal error',
  'messaging/quota-exceeded': 'FCM quota exceeded',
  'messaging/mismatched-credential': 'token belongs to another Firebase project',
  'messaging/invalid-argument': 'rejected payload/token',
}

export const describeReason = (reason?: string) => (reason ? REASONS[reason] ?? reason.replace(/_/g, ' ') : '')
export const describeCode = (code: string) => CODES[code] ?? code

export type DeliveryTone = 'ok' | 'partial' | 'failed' | 'pending'

export function deliveryTone(alert: AlertRecord): DeliveryTone {
  if (alert.status === 'awaiting_approval' || alert.delivery.status === 'pending') return 'pending'
  if (alert.delivery.status === 'sent') return 'ok'
  if (alert.delivery.status === 'partially_sent') return 'partial'
  return 'failed'
}

export const toneStyle: Record<DeliveryTone, { color: string; bg: string; label: string }> = {
  ok: { color: '#16A34A', bg: '#F0FDF4', label: 'Accepted by FCM' },
  partial: { color: '#D97706', bg: '#FFFBEB', label: 'Partially accepted' },
  failed: { color: '#DC2626', bg: '#FEF2F2', label: 'Not delivered' },
  pending: { color: '#C98A1E', bg: '#F4EEE1', label: 'Not dispatched yet' },
}
