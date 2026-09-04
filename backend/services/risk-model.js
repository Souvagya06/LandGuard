/**
 * Native Node.js implementation of LandGuard's deployed dual-agent model.
 *
 * Training may still happen offline with the notebooks/scripts, but the API
 * never shells out to Python or loads Python pickle files. Keeping inference
 * here makes the production path portable across Node deployments.
 */

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const sigmoid = (value) => 1 / (1 + Math.exp(-value))

function number(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Agent A: static terrain and ground-condition susceptibility. */
function predictSusceptibility(input) {
  const slope = clamp(number(input.slope_deg, 25) / 45)
  const elevation = clamp((number(input.elevation_m, 1000) - 150) / 1850)
  const vegetationLoss = 1 - clamp(number(input.ndvi, 0.55))
  const disturbance = clamp(number(input.sar_disturbance, 0.4) / 1.2)
  const vvChange = clamp(number(input.sar_vv_change, 0.3) / 0.8)
  const vhChange = clamp(number(input.sar_vh_change, 0.35) / 0.8)

  // A compact calibrated ensemble approximation for the offline Agent A model.
  const linear =
    -3.15 +
    2.15 * slope +
    0.35 * elevation +
    0.95 * vegetationLoss +
    1.4 * disturbance +
    0.42 * vvChange +
    0.48 * vhChange

  return clamp(sigmoid(linear))
}

/** Agent B: live rainfall-driven trigger probability. */
function predictTrigger(input, susceptibilityScore) {
  const rain1d = clamp(number(input.rain_1d, 0) / 80)
  const rain3d = clamp(number(input.rain_3d_sum, 0) / 180)
  const rain7d = clamp(number(input.rain_7d_sum, 0) / 350)
  const max7d = clamp(number(input.rain_max_7d, 0) / 100)
  const api7d = clamp(number(input.api_7d, 0) / 250)

  const linear =
    -4.2 +
    1.9 * susceptibilityScore +
    2.3 * rain1d +
    1.05 * rain3d +
    1.25 * rain7d +
    0.6 * max7d +
    0.85 * api7d

  return clamp(sigmoid(linear))
}

function riskLevel(score) {
  if (score >= 75) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 30) return 'moderate'
  return 'low'
}

function evaluateRisk(input) {
  const susceptibility_score = predictSusceptibility(input)
  const trigger_probability = predictTrigger(input, susceptibility_score)
  const roadPenalty = input.roadStatus === 'blocked' ? 8 : input.roadStatus === 'restricted' ? 4 : 0
  const risk_score = Math.max(1, Math.min(99, Math.round(susceptibility_score * 40 + trigger_probability * 50 + roadPenalty)))

  return {
    susceptibility_score: Math.round(susceptibility_score * 10000) / 10000,
    trigger_probability: Math.round(trigger_probability * 10000) / 10000,
    risk_score,
    risk_level: riskLevel(risk_score),
  }
}

module.exports = { evaluateRisk }
