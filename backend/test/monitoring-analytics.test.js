const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../services/monitoring/analytics');

const event = (id, lat, lng, date, extra = {}) => ({
  id, title: 'Landslide', dateMillis: date, latitude: lat, longitude: lng, state: 'Sikkim',
  nearestPlace: 'Gangtok', locationDescription: null, locationAccuracy: null, category: null,
  trigger: 'downpour', size: null, fatalities: 0, injuries: 0, sourceName: null, sourceLink: null, ...extra,
});

test('formatFixed matches Java %.Nf half-up rounding', () => {
  assert.equal(analytics.formatFixed(1.005, 2), '1.01');
  assert.equal(analytics.formatFixed(2.5, 0), '3');
  assert.equal(analytics.formatFixed(0.125, 2), '0.13');
  assert.equal(analytics.formatFixed(-0.04, 1), '-0.0');
  assert.equal(analytics.formatFixed(-1.25, 1), '-1.3');
  assert.equal(analytics.formatFixed(27.3349, 2), '27.33');
  assert.equal(analytics.formatFixed(12, 0), '12');
});

test('clustering is deterministic and uses the same ids as the Android app', () => {
  const events = [
    event('a', 27.33, 88.61, 1_600_000_000_000),
    event('b', 27.34, 88.62, 1_500_000_000_000),
    event('c', 26.10, 91.70, 1_700_000_000_000, { state: 'Assam', nearestPlace: 'Guwahati' }),
  ];
  const hotspots = analytics.cluster(events);
  assert.equal(hotspots.length, 2);
  const gangtok = hotspots.find((h) => h.name === 'Near Gangtok');
  // Centroid (27.335, 88.615) → Math.round(2733.5)=2734, Math.round(8861.5)=8862, same as Java Math.round.
  assert.equal(gangtok.id, 'glc_2734_8862');
  assert.equal(gangtok.eventCount, 2);
  assert.equal(gangtok.events[0].id, 'a', 'events are newest first');
  assert.deepEqual(analytics.cluster([...events].reverse()).map((h) => h.id).sort(), hotspots.map((h) => h.id).sort());
});

test('duplicate place names are disambiguated by position', () => {
  const hotspots = analytics.cluster([event('a', 27.0, 88.0, 1), event('b', 28.0, 88.0, 2)]);
  assert.deepEqual(hotspots.map((h) => h.name).sort(), ['Near Gangtok (27.00°N, 88.00°E)', 'Near Gangtok (28.00°N, 88.00°E)']);
});

test('hotspot risk reproduces the Kotlin weighted index', () => {
  const hotspot = { eventCount: 10, fatalities: 5 };
  const rainfall = { past72hMm: 90, next24hMm: 30, soilMoistureM3M3: 0.3, source: 's', fetchedAtMillis: 0 };
  const terrain = { elevationM: 1500, slopeDeg: 30, source: 'dem' };
  const risk = analytics.hotspotRisk(hotspot, { rainfall, terrain });
  // record: ln(11)/ln(11) + 0.05 → capped 1 → 100 ; rain: 120/150 → 80 ; slope: 20/25 → 80
  assert.deepEqual(risk.factors.map((f) => f.score), [100, 80, 80]);
  assert.equal(risk.score, Math.trunc((100 * 0.45 + 80 * 0.35 + 80 * 0.20) / 1.0));
  assert.equal(risk.level, 'critical');
  assert.equal(risk.factors[1].detail, '90 mm past 72 h, 30 mm next 24 h');
  assert.equal(risk.factors[2].detail, '30° mean slope');
});

test('missing conditions renormalise weights and report coverage honestly', () => {
  const risk = analytics.hotspotRisk({ eventCount: 1, fatalities: 0 }, null);
  assert.equal(risk.factors.length, 1);
  assert.equal(risk.coverage, 0.45);
  assert.equal(risk.score, Math.trunc(Math.log(2) / Math.log(11) * 100));
});

test('location risk refuses to score with less than half of the model backed by data', () => {
  const none = { available: false, reason: 'x' };
  const result = analytics.locationRisk(none, none, none, { available: true, value: { slopeDeg: 40 } }, none);
  assert.equal(result.available, false);
});
