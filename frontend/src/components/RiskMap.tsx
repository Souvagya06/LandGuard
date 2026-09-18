import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Rectangle, Tooltip, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { CircleMarker as LeafletCircleMarker, LatLngBoundsExpression } from 'leaflet'
import { Crosshair, Layers, MapPin, Radio, Search, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { deleteReport } from '../lib/api'
import type { FieldReport, MonitoringZone, PublicAlert, RiskLevel } from '../types'
import { RISK_LEVELS, riskMeta } from '../lib/risk'

interface Props {
  zones: MonitoringZone[]
  selectedId?: string
  onSelect: (zone: MonitoringZone) => void
  activeAlerts?: PublicAlert[]
  fieldReports?: FieldReport[]
  regionBounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }
  onAnalyzePoint?: (lat: number, lng: number) => void
  levelFilter: 'all' | RiskLevel
  onLevelFilterChange: (level: 'all' | RiskLevel) => void
}

/** Same three styles and labels as the Android map (RiskMapStyle). */
type MapStyle = 'streets' | 'terrain' | 'satellite'

const MAP_STYLES: Record<MapStyle, { label: string; url: string; attribution: string; maxZoom: number }> = {
  streets: {
    label: 'Map',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  terrain: {
    label: 'Terrain',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Style &copy; OpenTopoMap',
    maxZoom: 17,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
  },
}

/** Monitored areas are 15 km landslide clusters (RegionalAnalytics.CLUSTER_RADIUS_KM). */
const AREA_RADIUS_M = 15_000

function MapController({
  targetLocation,
  targetBounds,
}: {
  targetLocation?: { lat: number; lng: number; zoom?: number } | null
  targetBounds?: LatLngBoundsExpression | null
}) {
  const map = useMap()

  useEffect(() => {
    if (targetLocation) {
      map.flyTo([targetLocation.lat, targetLocation.lng], targetLocation.zoom || 12, { duration: 1.2 })
    }
  }, [targetLocation, map])

  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, { padding: [60, 60], maxZoom: 13 })
    }
  }, [targetBounds, map])

  return null
}

function FlyTo({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap()
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 11), { duration: 1.0 })
    }
  }, [lat, lng, map])
  return null
}

function FitRegion({ bounds }: { bounds?: LatLngBoundsExpression }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
      if (bounds && !done.current && container.clientHeight > 0) {
        const wide = container.clientWidth >= 900
        map.fitBounds(bounds, { paddingTopLeft: [wide ? 360 : 16, 64], paddingBottomRight: [16, 56] })
        done.current = true
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [bounds, map])
  return null
}

function ClickCapture({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4))) })
  return null
}

function ReportMarker({
  report,
  isSelected,
  onSelect,
  onDelete,
}: {
  report: FieldReport
  isSelected: boolean
  onSelect: () => void
  onDelete: (id: string) => void
}) {
  const markerRef = useRef<LeafletCircleMarker | null>(null)

  useEffect(() => {
    if (isSelected && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [isSelected])

  return (
    <CircleMarker
      ref={markerRef}
      center={[report.lat, report.lng]}
      radius={isSelected ? 10 : 7}
      pathOptions={{
        color: '#ffffff',
        fillColor: isSelected ? '#EA580C' : '#C98A1E',
        fillOpacity: 1,
        weight: isSelected ? 3 : 2,
      }}
      eventHandlers={{
        click: () => onSelect(),
      }}
    >
      <Popup minWidth={220} maxWidth={280}>
        <div className="space-y-2 p-1 text-[12px]">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
            <p className="font-bold text-ochre flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Field report
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(report.id)
              }}
              title="Delete this field report"
              className="flex items-center gap-1 rounded bg-critical-bg px-1.5 py-0.5 text-[10px] font-bold text-critical hover:bg-critical/20"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
          <p className="font-medium text-ink leading-relaxed">{report.note}</p>
          {report.photoDataUrl && (
            <img
              src={report.photoDataUrl}
              alt="Field observation"
              className="max-h-36 w-full rounded-lg object-cover"
            />
          )}
          <div className="flex items-center justify-between text-[11px] text-ink-3 pt-1 border-t border-line font-mono">
            <span>{report.zoneName}</span>
            <span>{new Date(report.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
}

export default function RiskMap({
  zones,
  selectedId,
  onSelect,
  activeAlerts = [],
  fieldReports = [],
  regionBounds,
  onAnalyzePoint,
  levelFilter,
  onLevelFilterChange,
}: Props) {
  const queryClient = useQueryClient()
  const [style, setStyle] = useState<MapStyle>('terrain')
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showAreas, setShowAreas] = useState(true)
  const [showReports, setShowReports] = useState(true)
  const [clicked, setClicked] = useState<{ lat: number; lng: number } | null>(null)
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [targetBounds, setTargetBounds] = useState<LatLngBoundsExpression | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const selected = zones.find((z) => z.id === selectedId)
  const alertedZoneIds = new Set(activeAlerts.map((a) => a.zoneId))
  const bounds: LatLngBoundsExpression | undefined = regionBounds
    ? [[regionBounds.minLat, regionBounds.minLng], [regionBounds.maxLat, regionBounds.maxLng]]
    : undefined

  const q = search.trim().toLowerCase()

  const matchingZones = useMemo(() => {
    if (!q) return []
    return zones
      .filter((z) => z.name.toLowerCase().includes(q) || z.state.toLowerCase().includes(q))
      .slice(0, 8)
  }, [zones, q])

  const visible = zones.filter(
    (z) =>
      (levelFilter === 'all' || z.risk.level === levelFilter) &&
      (!q || z.name.toLowerCase().includes(q) || z.state.toLowerCase().includes(q)),
  )

  const count = (level: RiskLevel) => zones.filter((z) => z.risk.level === level).length

  const handleSelectZone = (zone: MonitoringZone) => {
    onSelect(zone)
    setTargetLocation({ lat: zone.lat, lng: zone.lng, zoom: 12 })
    setSearch(zone.name)
    setSearchFocused(false)
  }

  const handleReportsButtonClick = () => {
    setShowReports(true)
    if (fieldReports.length === 0) {
      alert('No field reports recorded yet. Observations submitted from the field will appear here.')
      return
    }
    if (fieldReports.length === 1) {
      const rep = fieldReports[0]
      setTargetLocation({ lat: rep.lat, lng: rep.lng, zoom: 13 })
      setSelectedReportId(rep.id)
    } else {
      const coords: [number, number][] = fieldReports.map((r) => [r.lat, r.lng])
      setTargetBounds(coords)
      setSelectedReportId(fieldReports[0].id)
    }
  }

  const handleDeleteReport = async (id: string) => {
    if (window.confirm('Delete this field report?')) {
      try {
        await deleteReport(id)
        queryClient.invalidateQueries({ queryKey: ['reports'] })
      } catch (err) {
        alert((err as Error).message || 'Failed to delete report')
      }
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Search + style switcher (Android: floating glass controls) */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex flex-wrap items-start justify-between gap-2">
        {/* Search input with autocomplete dropdown */}
        <div className="relative w-full max-w-xs pointer-events-auto">
          <label className="glass flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 shadow-sm border border-line focus-within:border-brand">
            <Search className="h-4 w-4 text-ink-3 shrink-0" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSearchFocused(true)
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => setSearchFocused(false), 250)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (matchingZones.length > 0) handleSelectZone(matchingZones[0])
                } else if (e.key === 'Escape') {
                  setSearchFocused(false)
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Search area or state…"
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSearchFocused(false)
                }}
                className="text-ink-3 hover:text-ink p-0.5 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          {/* Autocomplete Dropdown */}
          {searchFocused && q && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-[1200] max-h-64 overflow-y-auto rounded-2xl glass p-1.5 shadow-xl border border-line bg-surface/95 backdrop-blur-md">
              {matchingZones.length > 0 ? (
                matchingZones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectZone(zone)
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-brand-container"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{zone.name}</p>
                      <p className="text-[11px] text-ink-3">{zone.state}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0"
                      style={{
                        background: riskMeta[zone.risk.level].container,
                        color: riskMeta[zone.risk.level].accent,
                      }}
                    >
                      {zone.risk.score} · {riskMeta[zone.risk.level].label}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2.5 text-[12px] text-ink-3 text-center">
                  No monitored area matching &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Style & layer switcher */}
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
          <Layers className="mx-1 h-4 w-4 text-ink-3" />
          {(Object.keys(MAP_STYLES) as MapStyle[]).map((key) => (
            <button
              key={key}
              onClick={() => setStyle(key)}
              className={`rounded-[11px] px-3 py-1.5 text-[12px] font-bold transition-colors ${style === key ? 'bg-brand text-white' : 'text-ink-2 hover:bg-elevated'}`}
            >
              {MAP_STYLES[key].label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <button
            type="button"
            onClick={() => setShowAreas((v) => !v)}
            title="Show monitored area extents (15 km clusters)"
            className={`flex items-center gap-1 rounded-[11px] px-2.5 py-1.5 text-[12px] font-bold transition-colors ${showAreas ? 'bg-brand-container text-brand' : 'text-ink-3 hover:bg-elevated'}`}
          >
            <Radio className="h-3.5 w-3.5" /> Areas
          </button>
          <button
            type="button"
            onClick={handleReportsButtonClick}
            title="Take me to field reports on the map"
            className={`flex items-center gap-1 rounded-[11px] px-2.5 py-1.5 text-[12px] font-bold transition-colors ${showReports ? 'bg-sand text-ochre ring-1 ring-ochre/30' : 'text-ink-3 hover:bg-elevated'}`}
          >
            <MapPin className="h-3.5 w-3.5" /> Reports {fieldReports.length > 0 ? `(${fieldReports.length})` : ''}
          </button>
        </div>
      </div>

      {/* Severity filter chips — same set as the Android Risk/Alerts filters */}
      <div className="absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
        <button
          onClick={() => onLevelFilterChange('all')}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-bold shadow-sm transition-colors ${levelFilter === 'all' ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2'}`}
        >
          All · {zones.length}
        </button>
        {RISK_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onLevelFilterChange(level)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold shadow-sm transition-colors"
            style={
              levelFilter === level
                ? { background: riskMeta[level].accent, borderColor: riskMeta[level].accent, color: '#fff' }
                : { background: riskMeta[level].container, borderColor: `${riskMeta[level].accent}40`, color: riskMeta[level].accent }
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: levelFilter === level ? '#fff' : riskMeta[level].accent }}
            />
            {riskMeta[level].label} · {count(level)}
          </button>
        ))}
      </div>

      <MapContainer
        center={[26.2, 92.9]}
        zoom={7}
        minZoom={5}
        scrollWheelZoom
        attributionControl={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          key={style}
          url={MAP_STYLES[style].url}
          maxZoom={MAP_STYLES[style].maxZoom}
        />
        <FitRegion bounds={bounds} />
        <MapController targetLocation={targetLocation} targetBounds={targetBounds} />
        <FlyTo lat={selected?.lat} lng={selected?.lng} />
        {onAnalyzePoint && <ClickCapture onClick={(lat, lng) => setClicked({ lat, lng })} />}

        {bounds && (
          <Rectangle
            bounds={bounds}
            pathOptions={{ color: '#1B5E37', weight: 1.2, dashArray: '6 6', fillOpacity: 0 }}
            interactive={false}
          />
        )}

        {clicked && onAnalyzePoint && (
          <Popup position={[clicked.lat, clicked.lng]} eventHandlers={{ remove: () => setClicked(null) }}>
            <div className="space-y-2 text-[12px]">
              <p className="flex items-center gap-1 font-bold text-ink">
                <Crosshair className="h-3.5 w-3.5" /> {clicked.lat.toFixed(4)}°N, {clicked.lng.toFixed(4)}°E
              </p>
              <button
                onClick={() => {
                  onAnalyzePoint(clicked.lat, clicked.lng)
                  setClicked(null)
                }}
                className="w-full rounded-lg bg-brand px-3 py-1.5 text-[12px] font-bold text-white hover:bg-brand-dark"
              >
                Analyse this location
              </button>
            </div>
          </Popup>
        )}

        {visible.map((zone) => {
          const color = riskMeta[zone.risk.level].accent
          const isSelected = zone.id === selectedId
          const elevated = zone.risk.level === 'high' || zone.risk.level === 'critical'
          const alerted = alertedZoneIds.has(zone.id)
          return (
            <Fragment key={zone.id}>
              {showAreas && (
                <Circle
                  center={[zone.lat, zone.lng]}
                  radius={AREA_RADIUS_M}
                  pathOptions={{
                    color: isSelected ? '#1B5E37' : color,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.22 : elevated ? 0.14 : 0.07,
                    weight: isSelected ? 2.5 : 1,
                    dashArray: isSelected ? undefined : '4 6',
                  }}
                  eventHandlers={{ click: () => onSelect(zone) }}
                />
              )}
              {(elevated || alerted) && (
                <CircleMarker
                  center={[zone.lat, zone.lng]}
                  radius={isSelected ? 22 : 16}
                  pathOptions={{
                    className: 'zone-ring-pulse',
                    color: alerted ? '#DC2626' : color,
                    fillOpacity: 0,
                    weight: alerted ? 3 : 2,
                  }}
                  interactive={false}
                />
              )}
              <CircleMarker
                center={[zone.lat, zone.lng]}
                radius={isSelected ? 11 : 7}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: color,
                  fillOpacity: 1,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{ click: () => onSelect(zone) }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div className="space-y-0.5">
                    <p className="text-[12.5px] font-bold text-ink">{zone.name}</p>
                    <p className="text-[11px] text-ink-3">{zone.state}</p>
                    <p className="text-[11.5px] font-bold" style={{ color }}>
                      {riskMeta[zone.risk.level].label} · {zone.risk.score}/100{alerted ? ' · ALERT ACTIVE' : ''}
                    </p>
                  </div>
                </Tooltip>
              </CircleMarker>
            </Fragment>
          )
        })}

        {showReports &&
          fieldReports.map((report) => (
            <ReportMarker
              key={report.id}
              report={report}
              isSelected={selectedReportId === report.id}
              onSelect={() => setSelectedReportId(report.id)}
              onDelete={handleDeleteReport}
            />
          ))}
      </MapContainer>
    </div>
  )
}
