import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchZones, sendWhatsAppAlert } from '../lib/api'
import type { Zone } from '../types'

const defaultMessage = (zone: Zone) =>
  `${zone.riskLevel.toUpperCase()} LANDSLIDE WARNING: Avoid ${zone.name} in ${zone.district}. Move to safer ground and follow local authority instructions.`

export default function SendAlert() {
  const queryClient = useQueryClient()
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  })
  const [zoneId, setZoneId] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof sendWhatsAppAlert>>>()

  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? zones[0]

  useEffect(() => {
    if (selectedZone && !message) setMessage(defaultMessage(selectedZone))
  }, [selectedZone, message])

  useEffect(() => {
    if (!zoneId && zones[0]) setZoneId(zones[0].id)
  }, [zoneId, zones])

  const sendMutation = useMutation({
    mutationFn: sendWhatsAppAlert,
    onSuccess: (sent) => {
      setResult(sent)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  function handleZoneChange(nextZoneId: string) {
    setZoneId(nextZoneId)
    const nextZone = zones.find((zone) => zone.id === nextZoneId)
    if (nextZone) setMessage(defaultMessage(nextZone))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedZone) return
    setResult(undefined)
    sendMutation.mutate({ zoneId: selectedZone.id, recipientPhone, message })
  }

  return (
    <div className="space-y-6">
      <div className="dashboard-intro">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#e0913f]">Authority console</p>
        <h1 className="text-2xl font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Send an alert
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#93a19a]">
          Reach a resident or field officer through WhatsApp with a warning tied to a monitored zone.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-[#26302d] bg-[#121716] p-5">
          <div>
            <label htmlFor="alert-zone" className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#93a19a]">Monitored zone</label>
            <select
              id="alert-zone"
              value={selectedZone?.id ?? ''}
              onChange={(event) => handleZoneChange(event.target.value)}
              disabled={zonesLoading || zones.length === 0}
              className="w-full rounded-sm border border-[#3a453f] bg-[#0b0f0e] px-3 py-2.5 text-sm text-[#eef2ef] outline-none focus:border-[#e0913f]"
            >
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.district} · {zone.riskLevel}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="recipient-phone" className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#93a19a]">WhatsApp number</label>
            <input
              id="recipient-phone"
              required
              type="tel"
              value={recipientPhone}
              onChange={(event) => setRecipientPhone(event.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-sm border border-[#3a453f] bg-[#0b0f0e] px-3 py-2.5 text-sm text-[#eef2ef] outline-none placeholder:text-[#5c6a64] focus:border-[#e0913f]"
            />
            <p className="mt-1.5 text-xs text-[#5c6a64]">Include the country code. Example: +91 for India.</p>
          </div>

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
              onChange={(event) => setMessage(event.target.value)}
              className="w-full resize-y rounded-sm border border-[#3a453f] bg-[#0b0f0e] px-3 py-2.5 text-sm leading-6 text-[#eef2ef] outline-none focus:border-[#e0913f]"
            />
          </div>

          {sendMutation.isError && <p className="border border-[#d9663f]/40 bg-[#d9663f]/10 px-3 py-2 text-sm text-[#e28e6c]">{sendMutation.error.message}</p>}
          {result && (
            <div className="border border-[#57b79e]/40 bg-[#57b79e]/10 px-3 py-3 text-sm text-[#a7e2d0]">
              Alert queued for WhatsApp delivery. Open WhatsApp to complete the send.
              <a href={result.whatsappUrl} target="_blank" rel="noreferrer" className="mt-2 block font-medium text-[#57b79e] underline underline-offset-4">Open WhatsApp</a>
            </div>
          )}

          <button type="submit" disabled={sendMutation.isPending || zonesLoading || !selectedZone} className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[#e0913f] px-4 py-2 text-sm font-medium text-[#1a1007] transition-colors hover:bg-[#f0a75b] disabled:cursor-not-allowed disabled:opacity-50">
            {sendMutation.isPending ? 'Preparing alert…' : 'Prepare WhatsApp alert'}
          </button>
        </form>

        <aside className="h-fit border border-[#26302d] bg-[#0f1412] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#57b79e]">Delivery path</p>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex gap-3"><span className="font-mono text-[#e0913f]">01</span><p className="text-[#93a19a]">Review the zone and recipient number.</p></div>
            <div className="flex gap-3"><span className="font-mono text-[#e0913f]">02</span><p className="text-[#93a19a]">Queue the warning in the alert log.</p></div>
            <div className="flex gap-3"><span className="font-mono text-[#e0913f]">03</span><p className="text-[#93a19a]">Open WhatsApp with the message ready to send.</p></div>
          </div>
          <p className="mt-6 border-t border-[#26302d] pt-4 text-xs leading-5 text-[#5c6a64]">The recipient must confirm the final send in WhatsApp. Automated provider delivery can be connected later without changing this alert form.</p>
        </aside>
      </div>
    </div>
  )
}