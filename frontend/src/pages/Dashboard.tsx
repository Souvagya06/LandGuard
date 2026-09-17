import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchZones, triggerAlert, fetchReports } from '../lib/api'
import type { Zone } from '../types'
import MetricCard from '../components/MetricCard'
import RiskMap from '../components/RiskMap'
import ZonePanel from '../components/ZonePanel'
import AnalysisPanel from '../components/AnalysisPanel'
import ReportSubmitModal from '../components/ReportSubmitModal'
import { isLandslideProne, levelFromScore, mapColor } from '../lib/risk'
import { playHazardAlertSound } from '../lib/audio'
import {
  ShieldAlert,
  CloudRain,
  Navigation,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Search,
  Volume2,
  X,
  ArrowUpRight
} from 'lucide-react'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [reportModalZoneId, setReportModalZoneId] = useState<string | null>(null)
  const [settlementSearch, setSettlementSearch] = useState('')
  const [directorySort, setDirectorySort] = useState<'risk' | 'name' | 'district'>('risk')
  const [riskAlertZone, setRiskAlertZone] = useState<Zone | null>(null)
  const announcedRiskZones = useRef(new Set<string>())

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

  const activeId = selectedId ?? zones.find((zone) => (zone.landslideRate ?? zone.riskScore) >= 75 || zone.riskLevel === 'critical')?.id ?? zones[0]?.id
  const selectedZone = zones.find((z) => z.id === activeId)

  const highRiskZones = useMemo(
    () => zones
      .filter((zone) => isLandslideProne(zone.landslideRate ?? zone.riskScore))
      .sort((a, b) => (b.landslideRate ?? b.riskScore) - (a.landslideRate ?? a.riskScore)),
    [zones],
  )

  useEffect(() => {
    const activeIds = new Set(highRiskZones.map((zone) => zone.id))
    announcedRiskZones.current.forEach((id) => {
      if (!activeIds.has(id)) announcedRiskZones.current.delete(id)
    })

    const newlyElevated = highRiskZones.find((zone) => !announcedRiskZones.current.has(zone.id))
    highRiskZones.forEach((zone) => announcedRiskZones.current.add(zone.id))

    if (newlyElevated) {
      setRiskAlertZone(newlyElevated)
      playHazardAlertSound(levelFromScore(newlyElevated.landslideRate ?? newlyElevated.riskScore))
    }
  }, [highRiskZones])

  const alertMutation = useMutation({
    mutationFn: (zone: Zone) => triggerAlert({ zoneId: zone.id, channel: 'dashboard' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const metrics = useMemo(() => {
    const critical = zones.filter((z) => (z.landslideRate ?? z.riskScore) >= 75 || z.riskLevel === 'critical').length
    const high = zones.filter((z) => {
      const score = z.landslideRate ?? z.riskScore
      return score >= 50 && score < 75
    }).length
    const blockedRoads = zones.filter((z) => z.roadStatus === 'blocked').length
    const highInSAR = zones.filter((z) => (z.deformationRateMm ?? 0) >= 15).length
    const maxRain = zones.length ? Math.max(...zones.map((z) => z.rainfall24h)) : 0
    const avgRain = zones.length
      ? Math.round(zones.reduce((s, z) => s + z.rainfall24h, 0) / zones.length)
      : 0
    return { critical, high, blockedRoads, highInSAR, maxRain, avgRain, villages: zones.length }
  }, [zones])

  // Ticker of urgent critical zones (>= 75%)
  const urgentZones = useMemo(() => {
    return zones.filter((z) => (z.landslideRate ?? z.riskScore) >= 75 || z.riskLevel === 'critical')
  }, [zones])

  const filteredSettlements = useMemo(() => {
    const filtered = !settlementSearch ? zones : (() => {
    const q = settlementSearch.toLowerCase()
    return zones.filter((z) => z.name.toLowerCase().includes(q) || z.district.toLowerCase().includes(q))
    })()
    return [...filtered].sort((a, b) => directorySort === 'risk'
      ? (b.landslideRate ?? b.riskScore) - (a.landslideRate ?? a.riskScore)
      : directorySort === 'name' ? a.name.localeCompare(b.name) : a.district.localeCompare(b.district))
  }, [zones, settlementSearch, directorySort])

  return (
    <div className="dashboard-page space-y-6">
      {riskAlertZone && (
        <div className="risk-alert-toast fixed right-4 top-20 z-[1200] w-[min(27rem,calc(100vw-2rem))] rounded-xl border border-red-400/60 bg-[#2a0e0d]/95 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.5),0_0_30px_rgba(239,68,68,0.2)] backdrop-blur-xl" role="alert">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-300">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-bold tracking-wide text-red-100">Authority critical risk notification</p>
                <button onClick={() => setRiskAlertZone(null)} className="rounded p-1 text-red-300 hover:bg-red-500/20 hover:text-white" aria-label="Dismiss risk notification">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-red-100/80">
                {riskAlertZone.name} has crossed the 75% critical landslide risk threshold.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-mono text-lg font-bold text-red-300">
                  {riskAlertZone.landslideRate ?? riskAlertZone.riskScore}% risk
                </span>
                <button
                  onClick={() => {
                    setSelectedId(riskAlertZone.id)
                    setRiskAlertZone(null)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-red-400"
                >
                  Inspect zone <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t border-red-300/15 pt-2 text-[10px] text-red-200/60">
            <Volume2 className="h-3 w-3" /> Audible danger notification issued
          </div>
        </div>
      )}

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

      <section className="glass-panel-glow rounded-xl border border-red-500/25 p-4 sm:p-5" aria-labelledby="authority-alerts-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="authority-alerts-heading" className="font-display text-sm font-bold text-[#f0f5f2]">Authority alert center</h2>
              <p className="mt-0.5 text-xs text-[#9bb0a6]">Every zone at or above the 75% critical intervention threshold.</p>
            </div>
          </div>
          <span className="rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-red-300">
            {highRiskZones.length} ACTIVE {highRiskZones.length === 1 ? 'ZONE' : 'ZONES'}
          </span>
        </div>
        {highRiskZones.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {highRiskZones.map((zone) => {
              const rate = zone.landslideRate ?? zone.riskScore
              return (
                <button
                  key={zone.id}
                  onClick={() => setSelectedId(zone.id)}
                  className="group flex items-center justify-between rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2.5 text-left transition-colors hover:border-red-400/60 hover:bg-red-500/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-red-100">{zone.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-red-200/60">{zone.district} · {zone.roadStatus} road</span>
                  </span>
                  <span className="ml-3 shrink-0 font-mono text-sm font-bold text-red-300">{rate}%</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-300">No intervention-level zones detected in the latest telemetry.</p>
        )}
      </section>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Critical Hazard Zones"
          value={metrics.critical}
          hint={metrics.critical > 0 ? `${metrics.critical} immediate danger (≥75%)` : '0 immediate danger (≥75%)'}
          icon={<ShieldAlert className="h-4 w-4" />}
          trend={`${metrics.critical > 0 ? 'Immediate action' : metrics.high > 0 ? `${metrics.high} high watch (50–74%)` : 'No escalation'}`}
          trendColor={metrics.critical > 0 ? 'red' : 'emerald'}
          dominant
        />
        <MetricCard
          label="Monitored Settlements"
          value={metrics.villages}
          hint="19 trained spatial coordinates"
          icon={<MapPin className="h-4 w-4" />}
          trend="Reporting"
          trendColor="emerald"
        />
        <MetricCard
          label="Max / Avg 24h Rain"
          value={`${metrics.maxRain} / ${metrics.avgRain}mm`}
          hint="Open-Meteo batch stream"
          icon={<CloudRain className="h-4 w-4" />}
          trend={metrics.maxRain > 70 ? 'Intense rain' : 'Within watch'}
          trendColor={metrics.maxRain > 70 ? 'amber' : 'cyan'}
        />
        <MetricCard
          label="Road Network Slumps"
          value={metrics.blockedRoads}
          hint={`${zones.filter(z => z.roadStatus === 'restricted').length} restricted single-lane`}
          icon={<Navigation className="h-4 w-4" />}
          trend={metrics.blockedRoads > 0 ? 'Diversion active' : 'No closures'}
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
              <span className="text-[10px] uppercase tracking-wider text-[#9bb0a6] font-semibold">
                Monitored Settlements Directory ({filteredSettlements.length})
              </span>
              <div className="hidden sm:flex items-center gap-1 text-[10px]">
                {(['risk', 'name', 'district'] as const).map((sort) => <button key={sort} onClick={() => setDirectorySort(sort)} className={`rounded px-1.5 py-1 capitalize ${directorySort === sort ? 'bg-cyan-500/15 text-cyan-300' : 'text-[#9bb0a6] hover:text-white'}`}>By {sort}</button>)}
              </div>
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
                const riskRate = zone.landslideRate ?? zone.riskScore
                const isCritical = isLandslideProne(riskRate)
                const markerColor = mapColor(levelFromScore(riskRate))
                const isSelected = zone.id === activeId
                const [place, qualifier = 'Monitoring sector'] = zone.name.split('—').map((part) => part.trim())

                return (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedId(zone.id)}
                    className={`rounded-lg border p-2.5 text-left transition-all relative ${
                      isSelected
                        ? 'border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : `${isCritical ? 'border-l-2 border-l-red-500' : riskRate >= 50 ? 'border-l-2 border-l-orange-400' : 'opacity-65'} border-[#1f2b27] bg-[#090d0c]/70 hover:border-[#2c3e38] hover:bg-[#111715]`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isCritical ? 'animate-ping' : ''}`}
                        style={{ backgroundColor: markerColor }}
                      />
                      <span className="font-mono text-[9px] text-[#596b63]">{zone.district.split(' ')[0]}</span>
                    </div>

                    <p className={`text-xs font-semibold ${
                      isCritical ? 'text-red-400' : 'text-[#f0f5f2]'
                    }`}>
                      {place}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-[#9bb0a6]">{qualifier}</p>
                    <p className="mt-0.5 text-[9px] text-[#596b63]">{zone.district}</p>

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
