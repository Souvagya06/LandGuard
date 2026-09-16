import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchZones, predictRisk, triggerAlert } from '../lib/api'
import type { PredictionResponse } from '../types'
import { riskMeta } from '../lib/risk'
import RiskBreakdown from '../components/RiskBreakdown'
import {
  Zap,
  Sliders,
  CloudRain,
  Mountain,
  Radio,
  Sparkles,
  Send,
  ShieldAlert,
  Loader2
} from 'lucide-react'

export default function SimulationStudio() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  })

  // Selected baseline zone or custom
  const queryZoneId = searchParams.get('zoneId')
  const queryLat = searchParams.get('lat')
  const queryLng = searchParams.get('lng')

  const [selectedZoneId, setSelectedZoneId] = useState<string>(queryZoneId || '')

  // Simulation sliders
  const [rain1d, setRain1d] = useState<number>(45)
  const [rain7d, setRain7d] = useState<number>(160)
  const [slopeDeg, setSlopeDeg] = useState<number>(32)
  const [sarDisturbance, setSarDisturbance] = useState<number>(0.5)
  const [ndvi, setNdvi] = useState<number>(0.5)
  const [elevation, setElevation] = useState<number>(1200)
  const [roadStatus, setRoadStatus] = useState<'open' | 'restricted' | 'blocked'>('open')

  // Custom coordinates
  const [lat, setLat] = useState<number>(queryLat ? Number(queryLat) : 27.5)
  const [lng, setLng] = useState<number>(queryLng ? Number(queryLng) : 93.8)

  // Simulation results
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [preview, setPreview] = useState<PredictionResponse | null>(null)
  const [isInferring, setIsInferring] = useState(false)
  const [alertSent, setAlertSent] = useState(false)

  // When zones load, set initial selection
  useEffect(() => {
    if (zones.length && !selectedZoneId && !queryLat) {
      setSelectedZoneId(zones[0].id)
    }
  }, [zones, selectedZoneId, queryLat])

  // Sync sliders when baseline zone changes
  useEffect(() => {
    if (selectedZoneId && zones.length) {
      const z = zones.find((item) => item.id === selectedZoneId)
      if (z) {
        setLat(z.lat)
        setLng(z.lng)
        setRain1d(z.rainfall24h)
        setRain7d(z.rainfall7d)
        setSarDisturbance(z.groundDeformation ?? 0.45)
        setRoadStatus(z.roadStatus)
      }
    }
  }, [selectedZoneId, zones])

  // Full-fidelity API inference is intentionally manual. Sliders use the
  // fast local preview below so their feedback remains immediate.
  const runSimulation = useCallback(async () => {
    setIsInferring(true)
    try {
      const res = await predictRisk({
        lat,
        lng,
        elevation_m: elevation,
        slope_deg: slopeDeg,
        ndvi,
        sar_disturbance: sarDisturbance,
        rain_1d: rain1d,
        rain_7d_sum: rain7d,
        roadStatus,
      })
      setPrediction(res)
      setPreview(res)
    } catch (err) {
      console.error('[Simulator] Inference error:', err)
    } finally {
      setIsInferring(false)
    }
  }, [lat, lng, elevation, slopeDeg, ndvi, sarDisturbance, rain1d, rain7d, roadStatus])

  const previewBand = useRef<string | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      const susceptibility = Math.min(0.95, Math.max(0.05, 0.12 + slopeDeg / 80 + sarDisturbance * 0.34 + (1 - ndvi) * 0.2))
      const trigger = Math.min(0.98, Math.max(0.03, susceptibility * 0.25 + rain1d / 220 + rain7d / 1100))
      const score = Math.min(99, Math.round(susceptibility * 40 + trigger * 50 + (roadStatus === 'blocked' ? 8 : roadStatus === 'restricted' ? 4 : 0)))
      const risk_level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
      const factors = [
        { label: 'Rainfall (24h + 7d)', value: Math.min(100, Math.round(rain1d * 0.42 + rain7d * 0.08)) },
        { label: 'Slope angle', value: Math.min(100, Math.round(slopeDeg * 1.7)) },
        { label: 'Soil / SAR disturbance', value: Math.min(100, Math.round(sarDisturbance * 72)) },
        { label: 'Vegetation loss', value: Math.min(100, Math.round((1 - ndvi) * 70)) },
      ]
      const changedBand = previewBand.current !== risk_level
      previewBand.current = risk_level
      setPreview({ lat, lng, risk_score: score, risk_level, susceptibility_score: susceptibility, trigger_probability: trigger, rainfall24h: rain1d, rainfall7d: rain7d, factors, explanation: changedBand ? `${risk_level.toUpperCase()} PREVIEW: ${risk_level === 'critical' ? 'Activate incident review and close exposed routes.' : risk_level === 'high' ? 'Restrict access and position field teams for inspection.' : risk_level === 'moderate' ? 'Monitor the corridor and limit travel near unstable slopes.' : 'Maintain routine observation and weather monitoring.'}` : preview?.explanation || 'Live approximate preview.', simulated: true, timestamp: new Date().toISOString() })
    }, 140)
    return () => clearTimeout(timer)
  }, [lat, lng, elevation, slopeDeg, ndvi, sarDisturbance, rain1d, rain7d, roadStatus])

  // Disaster Presets
  const applyPreset = (preset: 'cloudburst' | 'saturation' | 'sar_spike' | 'deforested' | 'baseline') => {
    if (preset === 'cloudburst') {
      setRain1d(145)
      setRain7d(320)
      setRoadStatus('blocked')
    } else if (preset === 'saturation') {
      setRain1d(65)
      setRain7d(480)
      setRoadStatus('restricted')
    } else if (preset === 'sar_spike') {
      setSarDisturbance(1.25)
      setSlopeDeg(42)
    } else if (preset === 'deforested') {
      setNdvi(0.12)
      setSlopeDeg(45)
    } else {
      setRain1d(12)
      setRain7d(40)
      setSarDisturbance(0.2)
      setNdvi(0.65)
      setRoadStatus('open')
    }
  }

  const displayedPrediction = preview ?? prediction
  const currentMeta = displayedPrediction ? riskMeta[displayedPrediction.risk_level] : riskMeta.low
  const currentZone = zones.find((z) => z.id === selectedZoneId)

  return (
    <div className="space-y-6 dashboard-page">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1f2b27] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Zap className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              What-If Landslide Simulation Studio
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#9bb0a6]">
            Interactive on-demand prediction laboratory. Test extreme precipitation, InSAR deformation, and terrain parameters against the Dual-Agent ML core.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#596b63] font-mono">Disaster Scenarios:</span>
          <button
            onClick={() => applyPreset('cloudburst')}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors"
          >
            🌧️ Cloudburst (145mm)
          </button>
          <button
            onClick={() => applyPreset('saturation')}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            📅 7-Day Saturation
          </button>
          <button
            onClick={() => applyPreset('sar_spike')}
            className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            📡 InSAR Spike (1.25)
          </button>
          <button
            onClick={() => applyPreset('baseline')}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            🌱 Stable Baseline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Left Column: Interactive Sliders & Parameter Controls */}
        <div className="glass-panel rounded-xl p-5 border border-[#1f2b27] space-y-5">
          <div className="flex items-center justify-between border-b border-[#1f2b27] pb-3">
            <h2 className="text-sm font-bold text-[#f0f5f2] flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" /> Physical & Meteorological Sliders
            </h2>

            {/* Target settlement picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9bb0a6]">Baseline Settlement:</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="rounded border border-[#1f2b27] bg-[#090d0c] px-2.5 py-1 text-xs text-[#f0f5f2] focus:outline-none focus:border-cyan-500"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.district})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Slider 1: 24h Rainfall */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#f0f5f2] flex items-center gap-1.5">
                <CloudRain className="h-3.5 w-3.5 text-emerald-400" /> 24-Hour Precipitation Load
              </span>
              <span className="font-mono font-bold text-emerald-400">{rain1d} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={rain1d}
              onChange={(e) => setRain1d(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-[#596b63] font-mono">
              <span>0mm (Dry)</span>
              <span>50mm (Heavy)</span>
              <span>100mm (Torrential)</span>
              <span>200mm (Cloudburst)</span>
            </div>
          </div>

          {/* Slider 2: 7-day Cumulative Rain */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#f0f5f2] flex items-center gap-1.5">
                <CloudRain className="h-3.5 w-3.5 text-cyan-400" /> 7-Day Cumulative Saturation Load
              </span>
              <span className="font-mono font-bold text-cyan-400">{rain7d} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="600"
              step="5"
              value={rain7d}
              onChange={(e) => setRain7d(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-[#596b63] font-mono">
              <span>0mm</span>
              <span>150mm</span>
              <span>300mm</span>
              <span>600mm (Critical Saturated)</span>
            </div>
          </div>

          {/* Slider 3: Slope Angle */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#f0f5f2] flex items-center gap-1.5">
                <Mountain className="h-3.5 w-3.5 text-amber-400" /> Slope Gradient Angle
              </span>
              <span className="font-mono font-bold text-amber-400">{slopeDeg}°</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={slopeDeg}
              onChange={(e) => setSlopeDeg(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-[#596b63] font-mono">
              <span>5° (Gentle)</span>
              <span>25° (Moderate)</span>
              <span>45° (Steep Ridge)</span>
              <span>60° (Precipice)</span>
            </div>
          </div>

          {/* Slider 4: InSAR Ground Disturbance */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#f0f5f2] flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-cyan-400" /> InSAR Satellite Ground Disturbance
              </span>
              <span className="font-mono font-bold text-cyan-400">
                {sarDisturbance.toFixed(2)} ({(sarDisturbance * 32).toFixed(1)} mm/yr)
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.50"
              step="0.05"
              value={sarDisturbance}
              onChange={(e) => setSarDisturbance(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-[#596b63] font-mono">
              <span>0.1 (Stable crust)</span>
              <span>0.5 (Active creep)</span>
              <span>1.0 (Rapid slip)</span>
              <span>1.5 (Failure imminent)</span>
            </div>
          </div>

          {/* Slider 5: NDVI Vegetation Index */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#f0f5f2] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> NDVI Canopy & Root Binding Index
              </span>
              <span className="font-mono font-bold text-emerald-400">{ndvi.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={ndvi}
              onChange={(e) => setNdvi(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-[#596b63] font-mono">
              <span>0.0 (Barren soil / Clearcut)</span>
              <span>0.5 (Mixed scrub)</span>
              <span>1.0 (Dense virgin canopy)</span>
            </div>
          </div>

          {/* Road status & coordinates selector */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1f2b27] text-xs">
            <div>
              <label className="block text-[#9bb0a6] mb-1">Road Network Status</label>
              <select
                value={roadStatus}
                onChange={(e) => setRoadStatus(e.target.value as 'open' | 'restricted' | 'blocked')}
                className="w-full rounded border border-[#1f2b27] bg-[#090d0c] p-2 text-[#f0f5f2] focus:outline-none"
              >
                <option value="open">Open Highway</option>
                <option value="restricted">Restricted Corridor</option>
                <option value="blocked">Blocked by Debris</option>
              </select>
            </div>
            <div>
              <label className="block text-[#9bb0a6] mb-1">Elevation (meters)</label>
              <input
                type="number"
                value={elevation}
                onChange={(e) => setElevation(Number(e.target.value))}
                className="w-full rounded border border-[#1f2b27] bg-[#090d0c] p-2 text-[#f0f5f2] focus:outline-none font-mono"
              />
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={isInferring}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-xs font-bold text-[#070a09] hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            {isInferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isInferring ? 'Running full-fidelity inference...' : 'Run full-fidelity ML inference'}
          </button>
        </div>

        {/* Right Column: Live Simulated Prediction Output */}
        <div className="glass-panel-glow rounded-xl p-5 border border-cyan-500/30 space-y-5">
          <div className="flex items-center justify-between border-b border-[#1f2b27] pb-3">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">
                Inference Result
              </span>
              <h3 className="text-base font-bold text-[#f0f5f2]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Simulated Hazard Evaluation
              </h3>
            </div>

            {displayedPrediction && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${currentMeta.bg} ${currentMeta.text} border border-current/20`}>
                <span className={`h-2 w-2 rounded-full ${currentMeta.dot} animate-ping`} />
                {currentMeta.label} · {displayedPrediction.risk_score}%
              </span>
            )}
          </div>

          {/* Large Risk Gauge */}
          <div className="rounded-lg border border-[#1f2b27] bg-[#090d0c] p-4 text-center space-y-3">
            <p className="text-xs text-[#9bb0a6]">Simulated Hazard Index</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-5xl font-extrabold font-mono tracking-tight text-[#f0f5f2]">
                {displayedPrediction?.risk_score ?? '--'}
              </span>
              <span className="text-2xl font-mono text-[#596b63]">/100</span>
            </div>

            {/* Susceptibility vs Trigger breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1a2420] text-xs">
              <div className="rounded bg-[#101614] p-2 border border-[#1f2b27]">
                <p className="text-[10px] text-[#9bb0a6]">Agent A (Terrain Susc.)</p>
                <p className="font-mono font-bold text-emerald-400">
                  {displayedPrediction ? Math.round(displayedPrediction.susceptibility_score * 100) : '--'}%
                </p>
              </div>
              <div className="rounded bg-[#101614] p-2 border border-[#1f2b27]">
                <p className="text-[10px] text-[#9bb0a6]">Agent B (Trigger Prob.)</p>
                <p className="font-mono font-bold text-amber-400">
                  {displayedPrediction ? Math.round(displayedPrediction.trigger_probability * 100) : '--'}%
                </p>
              </div>
            </div>
          </div>

          {/* SHAP Factor contributions under simulation */}
          {displayedPrediction?.factors && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#9bb0a6]">Simulated SHAP Contributions</p>
              <RiskBreakdown factors={displayedPrediction.factors} />
            </div>
          )}

          {/* Dynamic Generated AI Operational Narrative */}
          {displayedPrediction?.explanation && (
            <div className="rounded-lg border border-[#1f2b27] bg-[#090d0c] p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Simulated Operational Narrative</span>
              </div>
              <p className="text-xs leading-relaxed text-[#c2d1cb]">
                {displayedPrediction.explanation}
              </p>
            </div>
          )}

          {/* Action to dispatch warning or jump to real dashboard */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={async () => {
                if (currentZone) {
                  await triggerAlert({
                    zoneId: currentZone.id,
                    level: prediction?.risk_level,
                    message: `SIMULATED SCENARIO WARNING: Hazard probability evaluated at ${prediction?.risk_score}% under ${rain1d}mm 24h rain and ${sarDisturbance} InSAR creep.`,
                    channel: 'dashboard',
                  })
                  setAlertSent(true)
                  setTimeout(() => setAlertSent(false), 2500)
                }
              }}
              className="w-full rounded-lg border border-red-500/40 bg-red-500/15 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {alertSent ? 'Broadcast Dispatched to Dashboard!' : 'Dispatch Simulation Warning Broadcast'}
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full text-center text-xs text-[#9bb0a6] hover:text-[#f0f5f2] py-1 transition-colors"
            >
              ← Return to Live Monitoring Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
