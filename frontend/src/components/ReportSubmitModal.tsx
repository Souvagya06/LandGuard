import { useState } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { submitReport } from '../lib/api'
import type { Zone } from '../types'
import { Camera, MapPin, X, UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  zones: Zone[]
  selectedZoneId?: string
  onReportSubmitted: () => void
}

export default function ReportSubmitModal({ isOpen, onClose, zones, selectedZoneId, onReportSubmitted }: Props) {
  const [zoneId, setZoneId] = useState(selectedZoneId || (zones[0]?.id ?? 'custom'))
  const [note, setNote] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>()
  const [customLat, setCustomLat] = useState<number>(zones[0]?.lat ?? 27.5)
  const [customLng, setCustomLng] = useState<number>(zones[0]?.lng ?? 93.8)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleZoneChange = (id: string) => {
    setZoneId(id)
    const found = zones.find((z) => z.id === id)
    if (found) {
      setCustomLat(found.lat)
      setCustomLng(found.lng)
    }
  }

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file is too large. Please select a photo under 8MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setPhotoDataUrl(event.target?.result as string)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) {
      setError('Please provide observation details or notes from the field.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const currentZone = zones.find((z) => z.id === zoneId)
      await submitReport({
        zoneId: zoneId || 'custom',
        zoneName: currentZone?.name || 'Custom Field Location',
        note: note.trim(),
        photoDataUrl,
        lat: Number(customLat),
        lng: Number(customLng),
      })
      setSuccess(true)
      onReportSubmitted()
      setTimeout(() => {
        setSuccess(false)
        setNote('')
        setPhotoDataUrl(undefined)
        onClose()
      }, 1200)
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to submit report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel relative w-full max-w-lg rounded-xl border border-[#2c3e38] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1f2b27] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Submit Ground Truth Observation
              </h2>
              <p className="text-xs text-[#9bb0a6]">Report visible slope shifts, rockfall, or road blocks from the field</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#1f2b27] p-1.5 text-[#9bb0a6] hover:border-cyan-500/50 hover:bg-[#131a18] hover:text-[#f0f5f2] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Ground truth report synchronized successfully to LandGuard backend!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Settlement Selector */}
          <div>
            <label className="block text-xs font-medium text-[#9bb0a6] mb-1.5">Monitored Settlement / Sector</label>
            <select
              value={zoneId}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="w-full rounded-lg border border-[#1f2b27] bg-[#0d1211] px-3.5 py-2 text-sm text-[#f0f5f2] focus:border-cyan-500 focus:outline-none"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.district}) — {z.riskLevel.toUpperCase()}
                </option>
              ))}
              <option value="custom">-- Custom GPS Coordinate --</option>
            </select>
          </div>

          {/* Coordinates display */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[#596b63] mb-1">Latitude (°N)</label>
              <input
                type="number"
                step="0.0001"
                value={customLat}
                onChange={(e) => setCustomLat(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1f2b27] bg-[#0d1211] px-3 py-1.5 font-mono text-[#f0f5f2] focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#596b63] mb-1">Longitude (°E)</label>
              <input
                type="number"
                step="0.0001"
                value={customLng}
                onChange={(e) => setCustomLng(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1f2b27] bg-[#0d1211] px-3 py-1.5 font-mono text-[#f0f5f2] focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Observation Notes */}
          <div>
            <label className="block text-xs font-medium text-[#9bb0a6] mb-1.5">Observation Notes & Impact</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. Visible tension cracks along road shoulder, minor soil slump observed near culvert km 42..."
              className="w-full rounded-lg border border-[#1f2b27] bg-[#0d1211] p-3 text-xs text-[#f0f5f2] placeholder-[#596b63] focus:border-cyan-500 focus:outline-none resize-none"
            />
          </div>

          {/* Photo Upload with Preview */}
          <div>
            <label className="block text-xs font-medium text-[#9bb0a6] mb-1.5">Field Photo Evidence (Optional)</label>
            {photoDataUrl ? (
              <div className="relative rounded-lg border border-[#1f2b27] overflow-hidden bg-[#0a0d0c] max-h-48 flex items-center justify-center">
                <img src={photoDataUrl} alt="Preview" className="max-h-48 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-red-500 transition-colors"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#2c3e38] bg-[#0d1211] p-4 text-center cursor-pointer hover:border-cyan-500/60 hover:bg-[#131a18] transition-colors">
                <UploadCloud className="h-6 w-6 text-cyan-400" />
                <span className="text-xs text-[#9bb0a6]">Click to upload photo or take picture</span>
                <span className="text-[10px] text-[#596b63]">PNG, JPG, WEBP up to 8MB</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#1f2b27] px-4 py-2 text-xs font-medium text-[#9bb0a6] hover:bg-[#131a18] hover:text-[#f0f5f2] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2 text-xs font-semibold text-[#070a09] hover:bg-cyan-400 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5" /> Submit Ground Truth
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
