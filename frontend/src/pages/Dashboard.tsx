import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchZones, triggerAlert, fetchReports } from '../lib/api'
import type { Zone } from '../types'
import MetricCard from '../components/MetricCard'
import RiskMap from '../components/RiskMap'
import ZonePanel from '../components/ZonePanel'
import AnalysisPanel from '../components/AnalysisPanel'
import ReportSubmitModal from '../components/ReportSubmitModal'
import { isLandslideProne, riskMeta } from '../lib/risk'
import {
  ShieldAlert,
  CloudRain,
  Navigation,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Search
} from 'lucide-react'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [reportModalZoneId, setReportModalZoneId] = useState<string | null>(null)
  const [settlementSearch, setSettlementSearch] = useState('')

  const { data: zones = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    refetchInterval: 12000,
  })

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    refetchInterval: 15000,
  })

  const activeId = selectedId ?? zones[0]?.id
  const selectedZone = zones.find((z) => z.id === activeId)

  const alertMutation = useMutation({
    mutationFn: (zone: Zone) => triggerAlert({ zoneId: zone.id, channel: 'dashboard' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const metrics = useMemo(() => {
    const critical = zones.filter((z) => z.riskLevel === 'critical').length
    const high = zones.filter((z) => (z.landslideRate ?? z.riskScore) >= 50).length
    const blockedRoads = zones.filter((z) => z.roadStatus === 'blocked').length
    const highInSAR = zones.filter((z) => (z.deformationRateMm ?? 0) >= 15).length
    const maxRain = zones.length ? Math.max(...zones.map((z) => z.rainfall24h)) : 0
    const avgRain = zones.length
      ? Math.round(zones.reduce((s, z) => s + z.rainfall24h, 0) / zones.length)
      : 0
    return { critical, high, blockedRoads, highInSAR, maxRain, avgRain, villages: zones.length }
  }, [zones])

  // Ticker of urgent zones
  const urgentZones = useMemo(() => {
    return zones.filter((z) => z.riskLevel === 'critical' || z.riskLevel === 'high')
  }, [zones])

  const filteredSettlements = useMemo(() => {
    if (!settlementSearch) return zones
    const q = settlementSearch.toLowerCase()
    return zones.filter((z) => z.name.toLowerCase().includes(q) || z.district.toLowerCase().includes(q))
  }, [zones, settlementSearch])

  return (
    <div className="dashboard-page space-y-6">
      {/* Live Emergency Ticker Marquee */}
      {urgentZones.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-red-500/40 bg-red-950/20 py-1.5 px-3 text-xs backdrop-blur-md flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold uppercase text-red-400 shrink-0 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
            <AlertTriangle className="h-3 w-3 animate-ping" /> URGENT ADVISORY
          </span>
          <div className="overflow-hidden w-full">
            <div className="animate-ticker text-red-200 text-xs">
              {urgentZones.map((z) => (
                <span key={z.id} className="inline-flex items-center gap-2 mr-8">
                  <span className="font-bold text-white">{z.name} ({z.district}):</span>
                  <span>{z.riskLevel.toUpperCase()} RISK ({z.landslideRate ?? z.riskScore}%)</span>
                  <span>• 24h Rain: {z.rainfall24h}mm</span>
                  <span>• InSAR Deform: {z.deformationRateMm}mm/y</span>
                  <span>• Road: {z.roadStatus.toUpperCase()}</span>
                  <span className="text-red-500">|</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Intro & Telemetry Header */}
      <div className="dashboard-intro flex flex-wrap items-end justify-between gap-4 border-l-2 border-emerald-500 pl-4">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Geospatial Command & Telemetry Center
          </p>
          <h1 className="text-2xl font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Real-Time Landslide Risk Operations
          </h1>
          <p className="mt-1 text-xs text-[#9bb0a6]">
            Live multi-satellite InSAR, Open-Meteo precipitation stream, and Dual-Agent ML early warning across North East India.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-[#1f2b27] bg-[#0d1211] px-3 py-1.5 text-xs text-[#9bb0a6] hover:border-emerald-500/40 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>

          <div className="flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-lg text-xs text-emerald-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
            LIVE TELEMETRY
          </div>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Unable to load live telemetry from the backend API. Ensure the LandGuard server is running on port 8000.
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="High / Critical Zones"
          value={metrics.high}
          hint={`${metrics.critical} immediate danger`}
          icon={<ShieldAlert className="h-4 w-4" />}
          trend={`${metrics.critical > 0 ? 'Urgent' : 'Nominal'}`}
          trendColor={metrics.critical > 0 ? 'red' : 'emerald'}
        />
        <MetricCard
          label="Monitored Settlements"
          value={metrics.villages}
          hint="19 trained spatial coordinates"
          icon={<MapPin className="h-4 w-4" />}
          trend="100% Active"
          trendColor="emerald"
        />
        <MetricCard
          label="Max / Avg 24h Rain"
          value={`${metrics.maxRain} / ${metrics.avgRain}mm`}
          hint="Open-Meteo batch stream"
          icon={<CloudRain className="h-4 w-4" />}
          trend={metrics.maxRain > 70 ? 'High' : 'Normal'}
          trendColor={metrics.maxRain > 70 ? 'amber' : 'cyan'}
        />
        <MetricCard
          label="Road Network Slumps"
          value={metrics.blockedRoads}
          hint={`${zones.filter(z => z.roadStatus === 'restricted').length} restricted single-lane`}
          icon={<Navigation className="h-4 w-4" />}
          trend={metrics.blockedRoads > 0 ? 'Disrupted' : 'Clear'}
          trendColor={metrics.blockedRoads > 0 ? 'red' : 'emerald'}
        />
      </div>

      {/* Main Map + Zone Panel Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-3">
          {/* Geospatial Map */}
          <RiskMap
            zones={zones}
            selectedId={activeId}
            onSelect={(z: Zone) => setSelectedId(z.id)}
            fieldReports={reports}
          />

          {/* Settlement Search & Quick-Select Grid */}
          <div className="glass-panel rounded-xl p-3 border border-[#1f2b27] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#9bb0a6] font-semibold">
                Monitored Settlements Directory ({filteredSettlements.length})
              </span>
              <div className="flex items-center gap-1.5 rounded border border-[#1f2b27] bg-[#090d0c] px-2 py-1 text-xs w-48">
                <Search className="h-3 w-3 text-[#596b63]" />
                <input
                  type="text"
                  value={settlementSearch}
                  onChange={(e) => setSettlementSearch(e.target.value)}
                  placeholder="Quick filter..."
                  className="w-full bg-transparent text-[11px] text-[#f0f5f2] placeholder-[#596b63] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-56 overflow-y-auto pr-1">
              {filteredSettlements.map((zone) => {
                const isCritical = isLandslideProne(zone.landslideRate ?? zone.riskScore)
                const isSelected = zone.id === selectedId
                const meta = riskMeta[zone.riskLevel]

                return (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedId(zone.id)}
                    className={`rounded-lg border p-2.5 text-left transition-all relative ${
                      isSelected
                        ? 'border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'border-[#1f2b27] bg-[#090d0c]/70 hover:border-[#2c3e38] hover:bg-[#111715]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${isCritical ? 'animate-ping' : ''}`} />
                      <span className="font-mono text-[9px] text-[#596b63]">{zone.district.split(' ')[0]}</span>
                    </div>

                    <p className={`truncate text-xs font-semibold ${
                      isCritical ? 'text-red-400 risk-zone-name-blink' : 'text-[#f0f5f2]'
                    }`}>
                      {zone.name}
                    </p>

                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#9bb0a6]">{zone.landslideRate ?? zone.riskScore}% Rate</span>
                      <span className="text-[#596b63]">{zone.rainfall24h}mm</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Zone Details Panel */}
        <ZonePanel
          zone={selectedZone}
          onTriggerAlert={(z) => alertMutation.mutate(z)}
          sending={alertMutation.isPending}
          onOpenReportModal={(zoneId) => setReportModalZoneId(zoneId)}
        />
      </div>

      {/* Analysis & Predictive Charts Panel */}
      <AnalysisPanel zones={zones} selectedZone={selectedZone} />

      {/* Field Report Submission Modal */}
      <ReportSubmitModal
        isOpen={reportModalZoneId !== null}
        onClose={() => setReportModalZoneId(null)}
        zones={zones}
        selectedZoneId={reportModalZoneId || undefined}
        onReportSubmitted={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}
      />
    </div>
  )
}
