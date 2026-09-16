/** One source of truth for risk bands across API, model outputs, and clients. */
const RISK_BANDS = Object.freeze([
  { level: 'low', min: 0, max: 24 },
  { level: 'moderate', min: 25, max: 49 },
  { level: 'high', min: 50, max: 74 },
  { level: 'critical', min: 75, max: 100 },
]);

function riskLevel(score) {
  const value = Number(score);
  if (value >= 75) return 'critical';
  if (value >= 50) return 'high';
  if (value >= 25) return 'moderate';
  return 'low';
}

module.exports = { RISK_BANDS, riskLevel };
