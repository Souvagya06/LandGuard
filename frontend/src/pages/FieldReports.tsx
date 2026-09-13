import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchReports, fetchZones } from '../lib/api'
import ReportSubmitModal from '../components/ReportSubmitModal'
import { Camera, MapPin, CheckCircle2, Plus, Search, Image as ImageIcon } from 'lucide-react'

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export default function FieldReports() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    refetchInterval: 12000,
  })

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  })

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.zoneName.toLowerCase().includes(q) ||
      r.note.toLowerCase().includes(q) ||
      r.zoneId.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 dashboard-page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1f2b27] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Camera className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Ground-Truth Field Intelligence
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#9bb0a6]">
            Field officer verification, local community observations, and geotagged photographic reports from the slope.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-[#070a09] hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]"
        >
          <Plus className="h-4 w-4" /> Submit Field Observation
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">Total Observations</p>
          <p className="font-mono text-2xl font-bold text-[#f0f5f2] mt-1">{reports.length}</p>
          <p className="text-[10px] text-emerald-400 mt-0.5">Synced with core ML database</p>
        </div>
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">With Photo Evidence</p>
          <p className="font-mono text-2xl font-bold text-cyan-400 mt-1">
            {reports.filter((r) => !!r.photoDataUrl).length}
          </p>
          <p className="text-[10px] text-[#596b63] mt-0.5">Georeferenced frames</p>
        </div>
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">Sectors Monitored</p>
          <p className="font-mono text-2xl font-bold text-amber-400 mt-1">{zones.length || 19}</p>
          <p className="text-[10px] text-[#596b63] mt-0.5">Assam, Sikkim, Arunachal</p>
        </div>
        <div className="glass-panel rounded-lg p-3.5 border border-[#1f2b27]">
          <p className="text-xs text-[#9bb0a6]">Sync Status</p>
          <p className="font-mono text-2xl font-bold text-emerald-400 mt-1">Active</p>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">Real-time bi-directional sync</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#1f2b27] bg-[#0d1211] px-3 py-1.5 w-full sm:w-80">
          <Search className="h-3.5 w-3.5 text-[#9bb0a6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by sector, note, or ID..."
            className="w-full bg-transparent text-xs text-[#f0f5f2] placeholder-[#596b63] focus:outline-none"
          />
        </div>
        <p className="text-xs text-[#9bb0a6]">
          Showing {filteredReports.length} of {reports.length} observations
        </p>
      </div>

      {/* Reports Feed Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-sm text-[#9bb0a6]">Loading ground observations...</div>
      ) : filteredReports.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center border border-[#1f2b27] space-y-3">
          <Camera className="h-10 w-10 text-[#2c3e38] mx-auto" />
          <p className="text-sm font-medium text-[#f0f5f2]">No ground truth observations match query</p>
          <p className="text-xs text-[#9bb0a6] max-w-sm mx-auto">
            Be the first to record visual evidence or ground cracks from the slopes to calibrate the ML models.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-[#070a09]"
          >
            <Plus className="h-4 w-4" /> Submit First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="glass-panel rounded-xl overflow-hidden border border-[#1f2b27] flex flex-col justify-between hover:border-[#2c3e38] transition-all group"
            >
              {report.photoDataUrl ? (
                <div
                  onClick={() => setSelectedPhoto(report.photoDataUrl || null)}
                  className="relative h-44 w-full bg-[#090d0c] cursor-pointer overflow-hidden group-hover:opacity-95"
                >
                  <img
                    src={report.photoDataUrl}
                    alt="Field Observation"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1211] via-transparent to-transparent opacity-80" />
                  <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-[#f0f5f2] backdrop-blur-sm flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Click to enlarge
                  </span>
                </div>
              ) : (
                <div className="h-20 w-full bg-[#0a0d0c] border-b border-[#1f2b27] flex items-center justify-center text-xs text-[#596b63] gap-1.5">
                  <MapPin className="h-4 w-4 text-[#2c3e38]" />
                  <span>Geotagged Sensor Observation</span>
                </div>
              )}

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm text-[#f0f5f2]">{report.zoneName}</h3>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Synced
                    </span>
                  </div>

                  <p className="text-xs text-[#c2d1cb] leading-relaxed line-clamp-3 font-sans">
                    {report.note}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#1f2b27] flex items-center justify-between text-[11px] text-[#9bb0a6] font-mono">
                  <span className="flex items-center gap-1 text-[#596b63]">
                    <MapPin className="h-3 w-3 text-cyan-400" />
                    {report.lat.toFixed(3)}°N, {report.lng.toFixed(3)}°E
                  </span>
                  <span>{timeAgo(report.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo lightbox modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div className="max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-[#2c3e38]">
            <img src={selectedPhoto} alt="Enlarged evidence" className="max-h-[85vh] w-auto object-contain" />
          </div>
        </div>
      )}

      {/* Submission Modal */}
      <ReportSubmitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        zones={zones}
        onReportSubmitted={() => refetch()}
      />
    </div>
  )
}
