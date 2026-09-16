const test = require('node:test');
const assert = require('node:assert/strict');
const { riskLevel } = require('../services/risk-config');
const { evaluateRisk } = require('../services/risk-model');

test('risk bands have no threshold gaps', () => {
  assert.equal(riskLevel(0), 'low');
  assert.equal(riskLevel(24), 'low');
  assert.equal(riskLevel(25), 'moderate');
  assert.equal(riskLevel(49), 'moderate');
  assert.equal(riskLevel(50), 'high');
  assert.equal(riskLevel(74), 'high');
  assert.equal(riskLevel(75), 'critical');
});

test('portable model produces a bounded, named risk band', () => {
  const result = evaluateRisk({ slope_deg: 35, ndvi: 0.4, sar_disturbance: 0.7, rain_1d: 70, rain_7d_sum: 250, roadStatus: 'restricted' });
  assert.ok(result.risk_score >= 1 && result.risk_score <= 99);
  assert.equal(result.risk_level, riskLevel(result.risk_score));
});
