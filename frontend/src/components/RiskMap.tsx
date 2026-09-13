import { Fragment } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Zone } from '../types'
import { isLandslideProne, levelFromScore, mapColor } from '../lib/risk'

interface Props {
  zones: Zone[]
  selectedId?: string
  onSelect: (zone: Zone) => void
}

export default function RiskMap({ zones, selectedId, onSelect }: Props) {
  const center: [number, number] = [25.6, 92.9]

  return (
    <div className="map-frame h-[420px] w-full overflow-hidden rounded-lg border border-[#26302d]">
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((zone) => {
          const riskRate = zone.landslideRate ?? zone.riskScore
          const color = mapColor(levelFromScore(riskRate))
          const isProne = isLandslideProne(riskRate)

          return (
            <Fragment key={zone.id}>
              {isProne && (
                <CircleMarker
                  center={[zone.lat, zone.lng]}
                  radius={zone.id === selectedId ? 22 : 18}
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
                radius={zone.id === selectedId ? 14 : 10}
                pathOptions={{
                  className: isProne ? 'risk-zone-blink' : undefined,
                  color,
                  fillColor: color,
                  fillOpacity: 0.65,
                  weight: zone.id === selectedId ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => onSelect(zone) }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {zone.name} — {riskRate}% landslide risk rate
                </Tooltip>
              </CircleMarker>
            </Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
