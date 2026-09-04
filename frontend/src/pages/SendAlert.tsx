import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchZones } from '../lib/api'
import type { Zone } from '../types'

type WarningType = 'critical' | 'moderate' | 'casual'
type DeliveryMethod = 'popup' | 'app' | 'sms-app'

interface WarningOption {
  value: WarningType
  label: string
  badge: string
  description: string
  activeBorder: string
  activeBg: string
  badgeColor: string
  iconColor: string
}

const warningOptions: WarningOption[] = [
  {
    value: 'critical',
    label: 'Critical & Urgent',
    badge: 'Immediate Danger',
    description: 'Imminent landslide danger. Direct all residents and field personnel to evacuate immediately.',
    activeBorder: 'border-[#d9663f]',
    activeBg: 'bg-[#d9663f]/15 shadow-[0_0_20px_rgba(217,102,63,0.15)]',
    badgeColor: 'bg-[#d9663f]/20 text-[#ff8f6b] border-[#d9663f]/40',
    iconColor: 'text-[#d9663f]',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    badge: 'Elevated Risk',
    description: 'Heightened soil moisture or slope movement. Advise extra caution, monitoring, and travel limits.',
    activeBorder: 'border-[#e0a339]',
    activeBg: 'bg-[#e0a339]/15 shadow-[0_0_20px_rgba(224,163,57,0.15)]',
    badgeColor: 'bg-[#e0a339]/20 text-[#f5c36a] border-[#e0a339]/40',
    iconColor: 'text-[#e0a339]',
  },
  {
    value: 'casual',
    label: 'Casual Warning',
    badge: 'Advisory / Routine',
    description: 'Routine advisory, weather bulletin, or general awareness update for community vigilance.',
    activeBorder: 'border-[#57b79e]',
    activeBg: 'bg-[#57b79e]/15 shadow-[0_0_20px_rgba(87,183,158,0.15)]',
    badgeColor: 'bg-[#57b79e]/20 text-[#82e1c9] border-[#57b79e]/40',
    iconColor: 'text-[#57b79e]',
  },
]

interface DeliveryOption {
  value: DeliveryMethod
  label: string
  badge: string
  description: string
  details: string
}

const deliveryOptions: DeliveryOption[] = [
  {
    value: 'popup',
    label: 'Popup',
    badge: 'Instant Visual',
    description: 'Display an immediate high-priority emergency banner popup on the authority dashboard.',
    details: 'Real-time alert banner for active operators',
  },
  {
    value: 'app',
    label: 'Via App',
    badge: 'Push Notification',
    description: 'Send native push notification and in-app warning card to all LandGuard mobile & web app users.',
    details: 'Direct device notification with geo-fence matching',
  },
  {
    value: 'sms-app',
    label: 'SMS + App (Both)',
    badge: 'Dual Broadcast',
    description: 'Broadcast high-priority SMS messages via telecom gateway AND trigger LandGuard app push alerts.',
    details: 'Maximum reach — covers users with low internet connectivity',
  },
]

const defaultMessage = (zone: Zone, warningType: WarningType) => {
  const label =
    warningType === 'critical'
      ? '🚨 CRITICAL & URGENT LANDSLIDE ALERT'
      : warningType === 'moderate'
      ? '⚠️ MODERATE LANDSLIDE WARNING'
      : 'ℹ️ LANDSLIDE ADVISORY & AWARENESS'

  const action =
    warningType === 'critical'
      ? 'Immediate evacuation advisory is active. Move to safe designated shelters and follow local disaster authority instructions.'
      : warningType === 'moderate'
      ? 'Elevated ground movement & rainfall detected. Avoid steep slopes, unstable roads, and stay tuned for updates.'
      : 'Routine advisory. Maintain vigilance near slope regions and report any unusual ground movement.'

  return `${label}: High-risk alert for ${zone.name} (${zone.district} District). ${action}`
}

export default function SendAlert() {
  const [searchParams] = useSearchParams()
  const initialZoneFromUrl = searchParams.get('zone') ?? ''

  const { data: zones = [], isLoading, isError } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  })

  const [zoneId, setZoneId] = useState(initialZoneFromUrl)
  const [warningType, setWarningType] = useState<WarningType>('critical')
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('sms-app')
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sentAlertInfo, setSentAlertInfo] = useState<{
    zoneName: string
    district: string
    warningType: WarningType
    deliveryMethod: DeliveryMethod
    timestamp: string
  } | null>(null)

  const activeZoneId = zoneId || initialZoneFromUrl || zones[0]?.id || ''
  const selectedZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0]
  const message = customMessage !== null ? customMessage : (selectedZone ? defaultMessage(selectedZone, warningType) : '')

  function handleZoneChange(nextZoneId: string) {
    setZoneId(nextZoneId)
    setCustomMessage(null)
    setSentAlertInfo(null)
  }

  function handleWarningTypeChange(nextWarningType: WarningType) {
    setWarningType(nextWarningType)
    setCustomMessage(null)
    setSentAlertInfo(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedZone || !message.trim()) return

    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      setSentAlertInfo({
        zoneName: selectedZone.name,
        district: selectedZone.district,
        warningType,
        deliveryMethod,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
    }, 600)
  }

  const selectedWarningOption = warningOptions.find((opt) => opt.value === warningType)
  const selectedDeliveryOption = deliveryOptions.find((opt) => opt.value === deliveryMethod)
  const selectedRiskPercent = selectedZone
    ? selectedZone.riskScore <= 1
      ? Math.round(selectedZone.riskScore * 100)
      : Math.round(selectedZone.riskScore)
    : 0

  return (
    <div className="mx-auto max-w-5xl space-y-8 dashboard-page pb-12">
      {/* Intro Header */}
      <div className="dashboard-intro">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e0913f]">
              Authority Broadcast Console
            </p>
            <h1 className="text-3xl font-semibold text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Send Landslide Alert
            </h1>
            <p className="mt-1 text-sm text-[#93a19a]">
              Select from all active monitored dashboard zones, configure parameters, and broadcast multichannel alerts.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[#26302d] bg-[#121716] px-3 py-1.5 font-mono text-xs text-[#57b79e]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#57b79e] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#57b79e]"></span>
            </span>
            {zones.length} Dashboard Zones Monitored
          </div>
        </div>
      </div>

      {/* Main Alert Box (Enlarged and Streamlined) */}
      <div className="rounded-xl border border-[#26302d] bg-[#121716]/95 p-6 shadow-2xl sm:p-8 lg:p-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Monitored Zone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="alert-zone" className="block text-xs font-semibold uppercase tracking-wider text-[#93a19a]">
                1. Select Monitored Zone ({zones.length} Locations)
              </label>
              {selectedZone && (
                <span className="font-mono text-xs text-[#57b79e]">
                  Dashboard Risk: <strong className="uppercase">{selectedZone.riskLevel}</strong> ({selectedRiskPercent}%)
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="alert-zone"
                required
                value={selectedZone?.id ?? ''}
                onChange={(event) => handleZoneChange(event.target.value)}
                disabled={isLoading || zones.length === 0}
                className="w-full appearance-none rounded-lg border border-[#3a453f] bg-[#0b0f0e] px-4 py-3.5 text-base font-medium text-[#eef2ef] outline-none transition-colors focus:border-[#e0913f] focus:ring-1 focus:ring-[#e0913f]"
              >
                {zones.map((zone) => {
                  const score = zone.riskScore <= 1 ? Math.round(zone.riskScore * 100) : Math.round(zone.riskScore)
                  return (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {zone.district} District ({score}% Risk · {zone.riskLevel.toUpperCase()})
                    </option>
                  )
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#93a19a]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {selectedZone && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                <div className="rounded-md border border-[#26302d] bg-[#0b0f0e]/80 p-2.5">
                  <span className="block text-[10px] uppercase tracking-wider text-[#93a19a]">District</span>
                  <span className="font-medium text-xs text-[#eef2ef]">{selectedZone.district}</span>
                </div>
                <div className="rounded-md border border-[#26302d] bg-[#0b0f0e]/80 p-2.5">
                  <span className="block text-[10px] uppercase tracking-wider text-[#93a19a]">Coordinates</span>
                  <span className="font-mono text-xs text-[#eef2ef]">{selectedZone.lat.toFixed(3)}°N, {selectedZone.lng.toFixed(3)}°E</span>
                </div>
                <div className="rounded-md border border-[#26302d] bg-[#0b0f0e]/80 p-2.5">
                  <span className="block text-[10px] uppercase tracking-wider text-[#93a19a]">24h Rain / 7d Rain</span>
                  <span className="font-mono text-xs text-[#57b79e]">{selectedZone.rainfall24h}mm / {selectedZone.rainfall7d}mm</span>
                </div>
                <div className="rounded-md border border-[#26302d] bg-[#0b0f0e]/80 p-2.5">
                  <span className="block text-[10px] uppercase tracking-wider text-[#93a19a]">Road Status</span>
                  <span className="font-mono text-xs uppercase text-[#e0913f]">{selectedZone.roadStatus}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Warning Type */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-xs font-semibold uppercase tracking-wider text-[#93a19a]">
                2. Warning Type
              </legend>
              <span className="font-mono text-xs text-[#93a19a]">
                Selected: <strong className="text-[#eef2ef]">{selectedWarningOption?.label}</strong>
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {warningOptions.map((option) => {
                const isSelected = warningType === option.value
                return (
                  <label
                    key={option.value}
                    onClick={() => handleWarningTypeChange(option.value)}
                    className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all duration-200 ${
                      isSelected
                        ? `${option.activeBorder} ${option.activeBg} ring-1 ${option.activeBorder}`
                        : 'border-[#26302d] bg-[#0b0f0e] hover:border-[#3a453f] hover:bg-[#0e1312]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="warning-type"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => handleWarningTypeChange(option.value)}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-base font-semibold text-[#eef2ef]">{option.label}</span>
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-mono font-medium ${option.badgeColor}`}>
                          {option.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#93a19a]">{option.description}</p>
                    </div>

                    <div className="mt-4 flex items-center gap-2 pt-2 border-t border-[#26302d]/60 font-mono text-[11px]">
                      <div className={`h-2.5 w-2.5 rounded-full ${isSelected ? (option.value === 'critical' ? 'bg-[#d9663f]' : option.value === 'moderate' ? 'bg-[#e0a339]' : 'bg-[#57b79e]') : 'bg-[#3a453f]'}`} />
                      <span className={isSelected ? 'text-[#eef2ef] font-medium' : 'text-[#5c6a64]'}>
                        {isSelected ? 'Active Selection' : 'Click to select'}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Section 3: Notification Delivery Method */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-xs font-semibold uppercase tracking-wider text-[#93a19a]">
                3. How do you want to send the notification?
              </legend>
              <span className="font-mono text-xs text-[#93a19a]">
                Channel: <strong className="text-[#57b79e]">{selectedDeliveryOption?.label}</strong>
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {deliveryOptions.map((option) => {
                const isSelected = deliveryMethod === option.value
                return (
                  <label
                    key={option.value}
                    onClick={() => {
                      setDeliveryMethod(option.value)
                      setSentAlertInfo(null)
                    }}
                    className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all duration-200 ${
                      isSelected
                        ? 'border-[#57b79e] bg-[#57b79e]/15 ring-1 border-[#57b79e] shadow-[0_0_20px_rgba(87,183,158,0.12)]'
                        : 'border-[#26302d] bg-[#0b0f0e] hover:border-[#3a453f] hover:bg-[#0e1312]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-method"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => {
                        setDeliveryMethod(option.value)
                        setSentAlertInfo(null)
                      }}
                      className="sr-only"
                    />

                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'border-[#57b79e] bg-[#57b79e]/20 text-[#57b79e]' : 'border-[#3a453f] text-[#93a19a]'}`}>
                            {option.value === 'popup' && (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                            )}
                            {option.value === 'app' && (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            )}
                            {option.value === 'sms-app' && (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            )}
                          </span>
                          <span className="text-base font-semibold text-[#eef2ef]">{option.label}</span>
                        </div>
                        <span className="rounded border border-[#57b79e]/30 bg-[#57b79e]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#82e1c9]">
                          {option.badge}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-[#93a19a]">{option.description}</p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-[#26302d]/60 font-mono text-[10px] text-[#5c6a64]">
                      {option.details}
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Section 4: Warning Message */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="alert-message" className="block text-xs font-semibold uppercase tracking-wider text-[#93a19a]">
                4. Warning Message Broadcast Content
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCustomMessage(null)
                  }}
                  className="font-mono text-xs text-[#e0913f] hover:underline"
                >
                  Reset to Template
                </button>
                <span className="font-mono text-xs text-[#5c6a64]">
                  {message.length} / 500 characters
                </span>
              </div>
            </div>

            <textarea
              id="alert-message"
              required
              maxLength={500}
              rows={4}
              value={message}
              onChange={(event) => {
                setCustomMessage(event.target.value)
                setSentAlertInfo(null)
              }}
              className="w-full resize-y rounded-lg border border-[#3a453f] bg-[#0b0f0e] p-4 text-sm leading-relaxed text-[#eef2ef] outline-none transition-colors focus:border-[#e0913f] focus:ring-1 focus:ring-[#e0913f]"
              placeholder="Enter comprehensive emergency instructions and zone guidance..."
            />
          </div>

          {/* Error Message */}
          {isError && (
            <div className="flex items-center gap-3 rounded-lg border border-[#d9663f]/40 bg-[#d9663f]/10 p-4 text-sm text-[#e28e6c]">
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Unable to connect to live zone telemetry. Please verify connection and retry.</span>
            </div>
          )}

          {/* Success Banner */}
          {sentAlertInfo && (
            <div className="rounded-xl border border-[#57b79e]/40 bg-[#57b79e]/10 p-5 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#57b79e]/20 text-[#57b79e]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-[#eef2ef]">
                    Alert Dispatched Successfully at {sentAlertInfo.timestamp}
                  </h4>
                  <p className="text-xs text-[#a7e2d0]">
                    Broadcast sent to <strong className="text-white">{sentAlertInfo.zoneName}</strong> ({sentAlertInfo.district} District) with level <strong className="uppercase text-white">{sentAlertInfo.warningType}</strong> via channel <strong className="text-white">{deliveryOptions.find((o) => o.value === sentAlertInfo.deliveryMethod)?.label}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Final Send Alert Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-[#26302d]">
            <div className="text-xs text-[#93a19a]">
              Authorizing entity: <strong className="text-[#eef2ef]">National Disaster Management Authority (NDMA)</strong>
            </div>

            <button
              type="submit"
              disabled={isLoading || !selectedZone || !message.trim() || isSending}
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#e0913f] px-8 py-3 text-base font-semibold text-[#1a1007] shadow-lg transition-all duration-150 hover:bg-[#f0a75b] hover:shadow-[0_0_24px_rgba(224,145,63,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-[#1a1007]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Broadcasting Alert...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <span>Send Alert</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
