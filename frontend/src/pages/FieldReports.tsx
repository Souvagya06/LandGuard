import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteReport, fetchReports } from '../lib/api'
import { useMonitoringZones } from '../lib/queries'
import ReportSubmitModal from '../components/ReportSubmitModal'
import { Camera, MapPin, CheckCircle2, Clock3, Plus, Search, Trash2, Image as ImageIcon } from 'lucide-react'

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
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    refetchInterval: 12000,
  })

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id)
      await deleteReport(id)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      refetch()
    } catch (err) {
      alert((err as Error).message || 'Failed to delete report')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const zonesQuery = useMonitoringZones()
  const zones = (zonesQuery.data?.zones ?? []).map((z) => ({ id: z.id, name: z.name, lat: z.lat, lng: z.lng }))

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.zoneName.toLowerCase().includes(q) ||
      r.note.toLowerCase().includes(q) ||
      r.zoneId.toLowerCase().includes(q)
    )
  })

  const statusLabel = (status: string) => status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : status === 'pending_review' ? 'Awaiting review' : 'Synced'

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-ochre/30 bg-sand text-ochre">
              <Camera className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-ink">
              Ground-Truth Field Intelligence
            </h1>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Field officer verification, local community observations, and geotagged photographic reports from the slope.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-ochre px-4 py-2 text-xs font-bold text-white hover:bg-[#A8731A] transition-colors"
        >
          <Plus className="h-4 w-4" /> Submit Field Observation
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card rounded-lg p-3.5 border border-line">
          <p className="text-xs text-ink-2">Total Observations</p>
          <p className="font-mono text-2xl font-bold text-ink mt-1">{reports.length}</p>
          <p className="text-[10px] text-brand mt-0.5">Synced with core ML database</p>
        </div>
        <div className="card rounded-lg p-3.5 border border-line">
          <p className="text-xs text-ink-2">With Photo Evidence</p>
          <p className="font-mono text-2xl font-bold text-sentinel mt-1">
            {reports.filter((r) => !!r.photoDataUrl).length}
          </p>
          <p className="text-[10px] text-ink-3 mt-0.5">Georeferenced frames</p>
        </div>
        <div className="card rounded-lg p-3.5 border border-line">
          <p className="text-xs text-ink-2">Monitored areas</p>
          <p className="font-mono text-2xl font-bold text-ochre mt-1">{zones.length || '—'}</p>
          <p className="text-[10px] text-ink-3 mt-0.5">Across the 8 Northeast states</p>
        </div>
        <div className="card rounded-lg p-3.5 border border-line">
          <p className="text-xs text-ink-2">Pending review</p>
          <p className="font-mono text-2xl font-bold text-brand mt-1">{reports.filter((r) => r.status === 'pending_review').length}</p>
          <p className="text-[10px] text-brand/80 mt-0.5">Awaiting operator verification</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 w-full sm:w-80">
          <Search className="h-3.5 w-3.5 text-ink-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by sector, note, or ID..."
            className="w-full bg-transparent text-xs text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </div>
        <p className="text-xs text-ink-2">
          Showing {filteredReports.length} of {reports.length} observations
        </p>
      </div>

      {/* Reports Feed Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-sm text-ink-2">Loading ground observations...</div>
      ) : filteredReports.length === 0 ? (
        <div className="card rounded-[20px] p-12 text-center border border-line space-y-3">
          <Camera className="h-10 w-10 text-ink-3 mx-auto" />
          <p className="text-sm font-medium text-ink">No ground truth observations match query</p>
          <p className="text-xs text-ink-2 max-w-sm mx-auto">
            Be the first to record visual evidence or ground cracks from the slopes to calibrate the ML models.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ochre px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Submit First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="card rounded-[20px] overflow-hidden border border-line flex flex-col justify-between hover:border-line transition-all group"
            >
              {report.photoDataUrl ? (
                <div
                  onClick={() => setSelectedPhoto(report.photoDataUrl || null)}
                  className="relative h-44 w-full bg-elevated cursor-pointer overflow-hidden group-hover:opacity-95"
                >
                  <img
                    src={report.photoDataUrl}
                    alt="Field Observation"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-80" />
                  <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-ink backdrop-blur-sm flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Click to enlarge
                  </span>
                </div>
              ) : (
                <div className="h-20 w-full bg-elevated border-b border-line flex items-center justify-center text-xs text-ink-3 gap-1.5">
                  <MapPin className="h-4 w-4 text-ink-3" />
                  <span>Geotagged Sensor Observation</span>
                </div>
              )}

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm text-ink truncate" title={report.zoneName}>{report.zoneName}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold flex items-center gap-1 ${
                        report.status === 'verified' ? 'bg-brand-container border-brand/30 text-brand' :
                        report.status === 'rejected' ? 'bg-critical-bg border-critical/30 text-critical' :
                        'bg-sand border-ochre/30 text-ochre'
                      }`}>
                        {report.status === 'verified' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock3 className="h-2.5 w-2.5" />} {statusLabel(report.status)}
                      </span>
                      {confirmDeleteId === report.id ? (
                        <div className="flex items-center gap-1 bg-critical-bg border border-critical/30 rounded-full px-1.5 py-0.5 animate-fadeIn">
                          <span className="text-[10px] font-bold text-critical">Delete?</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(report.id) }}
                            disabled={deletingId === report.id}
                            className="rounded bg-critical px-1.5 py-0.5 text-[9.5px] font-bold text-white hover:bg-critical/90"
                          >
                            {deletingId === report.id ? '…' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                            className="rounded bg-elevated px-1 text-[9.5px] font-medium text-ink-2 hover:text-ink"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(report.id) }}
                          title="Delete field report"
                          className="rounded-full p-1 text-ink-3 transition-colors hover:bg-critical-bg hover:text-critical"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-ink-2 leading-relaxed line-clamp-3 font-sans">
                    {report.note}
                  </p>
                </div>

                <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-ink-2 font-mono">
                  <span className="flex items-center gap-1 text-ink-3">
                    <MapPin className="h-3 w-3 text-sentinel" />
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
          <div className="max-w-4xl max-h-[90vh] overflow-hidden rounded-[20px] border border-line">
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
