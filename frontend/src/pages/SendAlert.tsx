import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchZones } from '../lib/api'
import type { Zone } from '../types'

type WarningType = 'critical' | 'moderate' | 'casual'
type DeliveryMethod = 'popup' | 'app' | 'sms-app'

const warningOptions: { value: WarningType; label: string; description: string; accent: string }[] = [
  { value: 'critical', label: 'Critical and urgent', description: 'Immediate danger. Ask people to move now.', accent: 'border-[#d9663f] bg-[#d9663f]/10' },
  { value: 'moderate', label: 'Moderate warning', description: 'Elevated risk. Recommend extra caution.', accent: 'border-[#e0a339] bg-[#e0a339]/10' },
  { value: 'casual', label: 'Casual warning', description: 'General awareness or routine update.', accent: 'border-[#57b79e] bg-[#57b79e]/10' },
]

const deliveryOptions: { value: DeliveryMethod; label: string; description: string }[] = [
  { value: 'popup', label: 'Popup', description: 'Show a warning popup on the dashboard.' },
  { value: 'app', label: 'Via app', description: 'Send it to users through the LandGuard app.' },
  { value: 'sms-app', label: 'SMS + app', description: 'Send through both SMS and the LandGuard app.' },
]

const defaultMessage = (zone: Zone, warningType: WarningType) => {
  const label = warningType === 'critical' ? 'CRITICAL AND URGENT' : warningType === 'moderate' ? 'MODERATE' : 'GENERAL'
  return `${label} LANDSLIDE WARNING: Stay alert near ${zone.name} in ${zone.district}. Follow local authority instructions.`
}

export default function SendAlert() {
  const { data: zones = [], isLoading, isError } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  })
  const [zoneId, setZoneId] = useState('')
  const [warningType, setWarningType] = useState<WarningType>('critical')
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('sms-app')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? zones[0]

  useEffect(() => {
    if (!zoneId && zones[0]) setZoneId(zones[0].id)
  }, [zoneId, zones])

  useEffect(() => {
    if (selectedZone && !message) setMessage(defaultMessage(selectedZone, warningType))
  }, [selectedZone, message])

  function handleZoneChange(nextZoneId: string) {
    setZoneId(nextZoneId)
    const nextZone = zones.find((zone) => zone.id === nextZoneId)
    if (nextZone) setMessage(defaultMessage(nextZone, warningType))
    setSent(false)
  }

  function handleWarningTypeChange(nextWarningType: WarningType) {
    setWarningType(nextWarningType)
    if (selectedZone) setMessage(defaultMessage(selectedZone, nextWarningType))
    setSent(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedZone) return
    setSent(true)
  }

  return (
    <div className="space-y-6">
      <div className="dashboard-intro">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#e0913f]">Authority console</p>
        <h1 className="text-2xl font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Send an alert
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#93a19a]">
          Prepare a landslide warning and choose how it should reach monitored users.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[#26302d] bg-[#121716] p-6 lg:p-8">
          <div>
            <label htmlFor="alert-zone" className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#93a19a]">Monitored zone</label>
            <select
              id="alert-zone"
              required
              value={selectedZone?.id ?? ''}
              onChange={(event) => handleZoneChange(event.target.value)}
              disabled={isLoading || zones.length === 0}
              className="w-full rounded-sm border border-[#3a453f] bg-[#0b0f0e] px-3 py-2.5 text-sm text-[#eef2ef] outline-none focus:border-[#e0913f]"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} · {zone.district} · {zone.riskLevel}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#93a19a]">Warning type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {warningOptions.map((option) => (
                <label key={option.value} className={`cursor-pointer rounded-sm border p-3 transition-colors ${warningType === option.value ? option.accent : 'border-[#26302d] hover:border-[#3a453f]'}`}>
                  <input type="radio" name="warning-type" value={option.value} checked={warningType === option.value} onChange={() => handleWarningTypeChange(option.value)} className="sr-only" />
                  <span className="block text-sm font-medium text-[#eef2ef]">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#93a19a]">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#93a19a]">How should we send the notification?</legend>
            <div className="space-y-2">
              {deliveryOptions.map((option) => (
                <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors ${deliveryMethod === option.value ? 'border-[#57b79e] bg-[#57b79e]/10' : 'border-[#26302d] hover:border-[#3a453f]'}`}>
                  <input type="radio" name="delivery-method" value={option.value} checked={deliveryMethod === option.value} onChange={() => { setDeliveryMethod(option.value); setSent(false) }} className="mt-1 accent-[#57b79e]" />
                  <span><span className="block text-sm font-medium text-[#eef2ef]">{option.label}</span><span className="mt-1 block text-xs text-[#93a19a]">{option.description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="alert-message" className="block text-xs font-medium uppercase tracking-wide text-[#93a19a]">Warning message</label>
              <span className="font-mono text-[10px] text-[#5c6a64]">{message.length}/500</span>
            </div>
            <textarea
              id="alert-message"
              required
              maxLength={500}
              rows={5}
              value={message}
              onChange={(event) => { setMessage(event.target.value); setSent(false) }}
              className="w-full resize-y rounded-sm border border-[#3a453f] bg-[#0b0f0e] px-3 py-2.5 text-sm leading-6 text-[#eef2ef] outline-none focus:border-[#e0913f]"
            />
          </div>

          {isError && <p className="border border-[#d9663f]/40 bg-[#d9663f]/10 px-3 py-2 text-sm text-[#e28e6c]">Unable to load monitored zones.</p>}
          {sent && <p className="border border-[#57b79e]/40 bg-[#57b79e]/10 px-3 py-2 text-sm text-[#a7e2d0]">Alert sent via {deliveryOptions.find((option) => option.value === deliveryMethod)?.label}.</p>}

          <button
            type="submit"
            disabled={isLoading || !selectedZone || !message.trim()}
            className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[#e0913f] px-4 py-2 text-sm font-medium text-[#1a1007] transition-colors hover:bg-[#f0a75b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send alert
          </button>
      </form>
    </div>
  )
}
