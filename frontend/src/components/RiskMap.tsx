import { Fragment, useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Zone, FieldReport } from '../types'
import { isLandslideProne, levelFromScore, mapColor } from '../lib/risk'
import { Layers, Search, MapPin, Compass } from 'lucide-react'

// Fix default leaflet icons
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  zones: Zone[]
  selectedId?: string
  onSelect: (zone: Zone) => void
  fieldReports?: FieldReport[]
  onCoordinateClick?: (lat: number, lng: number) => void
}

type MapLayerType = 'satellite' | 'dark' | 'streets'

const MAP_LAYERS: Record<MapLayerType, { name: string; url: string; attribution: string; className?: string }> = {
  satellite: {
    name: 'Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  dark: {
    name: 'Cyber Dark (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: 'cyber-dark-tiles',
  },
  streets: {
    name: 'Terrain / Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
  },
}

// Helper component to pan map smoothly when selection changes
function MapFlyController({ targetLat, targetLng }: { targetLat?: number; targetLng?: number }) {
  const map = useMap()
  useEffect(() => {
    if (targetLat !== undefined && targetLng !== undefined) {
      map.flyTo([targetLat, targetLng], Math.max(map.getZoom(), 8), { duration: 1.2 })
    }
  }, [targetLat, targetLng, map])
  return null
}

// Click listener on map to capture arbitrary coordinates
function MapClickCapture({ onCoordSelect }: { onCoordSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCoordSelect(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)))
    },
  })
  return null
}

export default function RiskMap({ zones, selectedId, onSelect, fieldReports = [], onCoordinateClick }: Props) {
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('satellite')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'high' | 'blocked' | 'deform'>('all')
  const [showReports, setShowReports] = useState(true)
  const [clickedCoord, setClickedCoord] = useState<{ lat: number; lng: number } | null>(null)

  const defaultCenter: [number, number] = [26.2, 92.8]
  const selectedZone = zones.find((z) => z.id === selectedId)

  // Filtering zones
  const filteredZones = zones.filter((zone) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = zone.name.toLowerCase().includes(q) || zone.district.toLowerCase().includes(q)
      if (!match) return false
    }

    if (filterLevel === 'critical') return zone.riskLevel === 'critical'
    if (filterLevel === 'high') return zone.riskLevel === 'high' || zone.riskLevel === 'critical'
    if (filterLevel === 'blocked') return zone.roadStatus === 'blocked' || zone.roadStatus === 'restricted'
    if (filterLevel === 'deform') return (zone.deformationRateMm ?? 0) >= 15
    return true
  })

  const handleCoordClick = (lat: number, lng: number) => {
    setClickedCoord({ lat, lng })
    if (onCoordinateClick) {
      onCoordinateClick(lat, lng)
    }
  }

  return (
    <div className="map-frame h-[520px] w-full overflow-hidden rounded-xl border border-[#1f2b27] relative">
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Search Input */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[#2c3e38] bg-[#0d1211]/90 px-3 py-1.5 backdrop-blur-md shadow-lg w-64 sm:w-72">
          <Search className="h-3.5 w-3.5 text-[#9bb0a6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settlement or district..."
            className="w-full bg-transparent text-xs text-[#f0f5f2] placeholder-[#596b63] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[10px] text-[#9bb0a6] hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        {/* Layer Switcher & Overlays */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-[#2c3e38] bg-[#0d1211]/90 p-1 backdrop-blur-md shadow-lg">
          <Layers className="h-3.5 w-3.5 text-cyan-400 mx-1.5" />
          {(['satellite', 'dark', 'streets'] as MapLayerType[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-all ${
                activeLayer === layer
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-[#9bb0a6] hover:text-[#f0f5f2]'
              }`}
            >
              {MAP_LAYERS[layer].name.split(' ')[0]}
            </button>
          ))}
          <span className="h-3 w-px bg-[#1f2b27] mx-1" />
          <button
            onClick={() => setShowReports(!showReports)}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-all flex items-center gap-1 ${
              showReports
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-[#596b63] hover:text-[#9bb0a6]'
            }`}
            title="Toggle ground truth field report markers"
          >
            <MapPin className="h-3 w-3" /> Field Obs
          </button>
        </div>
      </div>

      {/* Filter Chips Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-1.5 pointer-events-auto max-w-[80%]">
        <button
          onClick={() => setFilterLevel('all')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-all ${
            filterLevel === 'all'
              ? 'bg-[#1f2b27] text-white border border-emerald-500/50'
              : 'bg-[#0d1211]/80 text-[#9bb0a6] border border-[#1f2b27] hover:border-[#2c3e38]'
          }`}
        >
          All Zones ({zones.length})
        </button>
        <button
          onClick={() => setFilterLevel('critical')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-all ${
            filterLevel === 'critical'
              ? 'bg-red-500/25 text-red-300 border border-red-500'
              : 'bg-[#0d1211]/80 text-red-400/80 border border-[#1f2b27] hover:border-red-500/40'
          }`}
        >
          🚨 Critical Only ({zones.filter((z) => z.riskLevel === 'critical').length})
        </button>
        <button
          onClick={() => setFilterLevel('blocked')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-all ${
            filterLevel === 'blocked'
              ? 'bg-amber-500/25 text-amber-300 border border-amber-500'
              : 'bg-[#0d1211]/80 text-amber-400/80 border border-[#1f2b27] hover:border-amber-500/40'
          }`}
        >
          🚧 Blocked Roads ({zones.filter((z) => z.roadStatus !== 'open').length})
        </button>
        <button
          onClick={() => setFilterLevel('deform')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-all ${
            filterLevel === 'deform'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500'
              : 'bg-[#0d1211]/80 text-cyan-400/80 border border-[#1f2b27] hover:border-cyan-500/40'
          }`}
        >
          📡 High InSAR Deform ({zones.filter((z) => (z.deformationRateMm ?? 0) >= 15).length})
        </button>
      </div>

      {/* Map Legend on bottom right */}
      <div className="absolute bottom-3 right-3 z-[1000] hidden sm:flex items-center gap-2 rounded-lg border border-[#1f2b27] bg-[#0d1211]/85 px-3 py-1.5 text-[10px] text-[#9bb0a6] backdrop-blur-md">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" /> Critical</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> High</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> Moderate</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Stable</span>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={selectedZone ? [selectedZone.lat, selectedZone.lng] : defaultCenter}
        zoom={7}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={activeLayer}
          attribution={MAP_LAYERS[activeLayer].attribution}
          url={MAP_LAYERS[activeLayer].url}
          maxZoom={18}
        />

        <MapFlyController targetLat={selectedZone?.lat} targetLng={selectedZone?.lng} />
        <MapClickCapture onCoordSelect={handleCoordClick} />

        {/* Selected zone indicator circle */}
        {selectedZone && (
          <CircleMarker
            center={[selectedZone.lat, selectedZone.lng]}
            radius={28}
            pathOptions={{
              color: '#06b6d4',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '4, 4',
            }}
            interactive={false}
          />
        )}

        {/* Clicked coordinate pin */}
        {clickedCoord && (
          <Popup position={[clickedCoord.lat, clickedCoord.lng]} eventHandlers={{ remove: () => setClickedCoord(null) }}>
            <div className="p-1 space-y-2 text-xs">
              <p className="font-mono font-semibold text-cyan-400 flex items-center gap-1">
                <Compass className="h-3.5 w-3.5" /> Target Coordinates
              </p>
              <p className="font-mono text-[#9bb0a6]">
                {clickedCoord.lat}°N, {clickedCoord.lng}°E
              </p>
              <button
                onClick={() => {
                  window.location.href = `/simulate?lat=${clickedCoord.lat}&lng=${clickedCoord.lng}`
                }}
                className="w-full rounded bg-cyan-500 px-2 py-1 text-[11px] font-semibold text-black hover:bg-cyan-400 transition-colors"
              >
                Simulate ML Risk at Point
              </button>
            </div>
          </Popup>
        )}

        {/* Zone Markers */}
        {filteredZones.map((zone) => {
          const riskRate = zone.landslideRate ?? zone.riskScore
          const color = mapColor(levelFromScore(riskRate))
          const isProne = isLandslideProne(riskRate)
          const isSelected = zone.id === selectedId

          return (
            <Fragment key={zone.id}>
              {isProne && (
                <CircleMarker
                  center={[zone.lat, zone.lng]}
                  radius={isSelected ? 26 : 20}
                  pathOptions={{
                    className: 'risk-zone-ring-blink',
                    color,
                    fillOpacity: 0,
                    opacity: 0.95,
                    weight: 3,
                  }}
                  interactive={false}
                />
              )}

              <CircleMarker
                center={[zone.lat, zone.lng]}
                radius={isSelected ? 15 : 10}
                pathOptions={{
                  className: isProne ? 'risk-zone-blink' : undefined,
                  color,
                  fillColor: color,
                  fillOpacity: 0.75,
                  weight: isSelected ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => onSelect(zone) }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                  <div className="text-xs p-0.5 space-y-0.5">
                    <p className="font-bold text-[#f0f5f2]">{zone.name}</p>
                    <p className="text-[10px] text-[#9bb0a6]">{zone.district}</p>
                    <div className="flex items-center gap-2 pt-0.5 font-mono text-[10px]">
                      <span className="font-bold" style={{ color }}>{riskRate}% Risk</span>
                      <span>• {zone.rainfall24h}mm Rain</span>
                      <span>• {zone.roadStatus.toUpperCase()}</span>
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            </Fragment>
          )
        })}

        {/* Field Report Pins Overlay */}
        {showReports &&
          fieldReports.map((report) => (
            <CircleMarker
              key={report.id}
              center={[report.lat, report.lng]}
              radius={6}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <div className="p-1 space-y-1.5 text-xs max-w-xs">
                  <div className="flex items-center justify-between border-b border-[#1f2b27] pb-1">
                    <span className="font-semibold text-amber-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Field Observation
                    </span>
                    <span className="font-mono text-[10px] text-[#596b63]">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#f0f5f2]">{report.note}</p>
                  {report.photoDataUrl && (
                    <img
                      src={report.photoDataUrl}
                      alt="Field Observation"
                      className="rounded border border-[#1f2b27] max-h-32 w-full object-cover"
                    />
                  )}
                  <p className="font-mono text-[10px] text-[#9bb0a6]">
                    Location: {report.lat.toFixed(3)}°N, {report.lng.toFixed(3)}°E
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  )
}
