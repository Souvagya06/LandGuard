import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Zone } from '../types'
import { mapColor } from '../lib/risk'

interface Props {
  zones: Zone[]
  selectedId?: string
  onSelect: (zone: Zone) => void
}

export default function RiskMap({ zones, selectedId, onSelect }: Props) {
  const center: [number, number] = [25.6, 92.9]

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-neutral-200">
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((zone) => (
          <CircleMarker
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={zone.id === selectedId ? 14 : 10}
            pathOptions={{
              color: mapColor(zone.riskLevel),
              fillColor: mapColor(zone.riskLevel),
              fillOpacity: 0.6,
              weight: zone.id === selectedId ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(zone) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {zone.name} — {zone.riskScore}% risk
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
