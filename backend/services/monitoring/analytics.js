/**
 * Regional analytics — a line-for-line port of the Android app's
 * `data/regional/RegionalAnalytics.kt` so the backend, the authority web and
 * the Android client produce identical monitored areas, IDs and risk scores
 * from the same inputs.
 *
 * Risk index — a documented heuristic over real inputs only:
 *   slope      0 at ≤10°, 1 at ≥35°            (Copernicus DEM)
 *   rainfall   (72 h observed + 24 h forecast) / 150 mm, capped  (Open-Meteo)
 *   record     recorded landslides nearby       (NASA GLC)
 *   vegetation NDVI drop vs. a year earlier; −0.15 → 1  (Sentinel-2)
 *   SAR        |ΔVV| from 0.5 dB to 3 dB → 0..1  (Sentinel-1)
 * Weights are renormalised over the inputs that are actually available; the
 * share of weight backed by data is reported as `coverage`.
 *
 * Kotlin semantics that matter for parity are reproduced explicitly:
 * `Double.toInt()` truncates toward zero, `minByOrNull`/`maxByOrNull` keep the
 * first extreme, and `String.format("%.Nf")` rounds half-up.
 */
const { riskLevel } = require('../risk-config');

const CLUSTER_RADIUS_KM = 15.0;
const RAIN_SATURATION_MM = 150.0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toInt = (value) => Math.trunc(value);

/** Java/Kotlin `%.Nf`: HALF_UP rounding of the shortest decimal representation. */
function formatFixed(value, digits) {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0 || Object.is(value, -0);
  let [intPart, fracPart = ''] = Math.abs(value).toString().split('.');
  if (/e/i.test(intPart) || /e/i.test(fracPart)) return value.toFixed(digits);
  const padded = (fracPart + '0'.repeat(digits + 1)).slice(0, digits + 1);
  let kept = BigInt(intPart + padded.slice(0, digits));
  if (Number(padded[digits]) >= 5) kept += 1n;
  let text = kept.toString().padStart(digits + 1, '0');
  text = digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
  // Java keeps the sign of values that round to zero ("-0.00").
  return negative ? `-${text}` : text;
}

const signed = (value, digits) => (value >= 0 ? `+${formatFixed(value, digits)}` : formatFixed(value, digits));

function distanceKm(lat1, lng1, lat2, lng2) {
  const r = 6371.0088;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.asin(Math.sqrt(clamp(a, 0, 1)));
}

const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** Kotlin `groupingBy { }.eachCount().maxByOrNull { it.value }?.key` — first key wins ties. */
function mostFrequent(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let bestKey = null;
  let best = -1;
  for (const [key, count] of counts) {
    if (count > best) { best = count; bestKey = key; }
  }
  return bestKey;
}

/** Greedy spatial clustering of events into areas of CLUSTER_RADIUS_KM. */
function cluster(events, radiusKm = CLUSTER_RADIUS_KM) {
  const clusters = [];
  const ordered = [...events].sort((a, b) => (a.dateMillis ?? 0) - (b.dateMillis ?? 0));
  for (const event of ordered) {
    let target = null;
    let targetDistance = Infinity;
    for (const c of clusters) {
      const d = distanceKm(c.lat, c.lng, event.latitude, event.longitude);
      if (d <= radiusKm && d < targetDistance) { target = c; targetDistance = d; }
    }
    if (!target) {
      clusters.push({ lat: event.latitude, lng: event.longitude, members: [event] });
    } else {
      target.members.push(event);
      target.lat = average(target.members.map((m) => m.latitude));
      target.lng = average(target.members.map((m) => m.longitude));
    }
  }

  const hotspots = clusters.map((c) => {
    const members = c.members;
    const place = mostFrequent(members.map((m) => m.nearestPlace).filter((p) => p != null));
    const description = members.map((m) => m.locationDescription).find((d) => d != null);
    const name = place != null ? `Near ${place}` : description != null ? description.substring(0, 48) : 'Landslide cluster';
    const dates = members.map((m) => m.dateMillis).filter((d) => d != null);
    return {
      id: `glc_${Math.round(c.lat * 100)}_${Math.round(c.lng * 100)}`,
      name,
      state: mostFrequent(members.map((m) => m.state)),
      latitude: c.lat,
      longitude: c.lng,
      eventCount: members.length,
      fatalities: members.reduce((sum, m) => sum + (m.fatalities || 0), 0),
      firstEventMillis: dates.length ? Math.min(...dates) : null,
      lastEventMillis: dates.length ? Math.max(...dates) : null,
      dominantTrigger: mostFrequent(members.map((m) => m.trigger).filter((t) => t != null)),
      events: [...members].sort((a, b) => (b.dateMillis ?? 0) - (a.dateMillis ?? 0)),
    };
  });

  // Several clusters can share a nearest place; tell them apart by position.
  const nameCounts = new Map();
  for (const h of hotspots) nameCounts.set(h.name, (nameCounts.get(h.name) || 0) + 1);
  return hotspots.map((h) => (nameCounts.get(h.name) > 1
    ? { ...h, name: `${h.name} (${formatFixed(h.latitude, 2)}°N, ${formatFixed(h.longitude, 2)}°E)` }
    : h));
}

const slopeFactor = (slopeDeg) => clamp((slopeDeg - 10.0) / 25.0, 0, 1);
const rainFactor = (r) => clamp((r.past72hMm + r.next24hMm) / RAIN_SATURATION_MM, 0, 1);

function combine(factors) {
  const weight = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = weight === 0 ? 0 : clamp(toInt(factors.reduce((sum, f) => sum + f.score * f.weight, 0) / weight), 0, 100);
  return { score, level: riskLevel(score), factors, coverage: weight };
}

function rainfallDetail(r) {
  return `${formatFixed(r.past72hMm, 0)} mm past 72 h, ${formatFixed(r.next24hMm, 0)} mm next 24 h`;
}

function hotspotRisk(hotspot, conditions) {
  const factors = [];
  const history = clamp(Math.log(1.0 + hotspot.eventCount) / Math.log(11.0) + hotspot.fatalities * 0.01, 0, 1);
  factors.push({
    name: 'Landslide record',
    score: toInt(history * 100),
    weight: 0.45,
    detail: `${hotspot.eventCount} recorded landslide${hotspot.eventCount === 1 ? '' : 's'}`,
  });
  if (conditions?.rainfall) {
    const r = conditions.rainfall;
    factors.push({ name: 'Rainfall', score: toInt(rainFactor(r) * 100), weight: 0.35, detail: rainfallDetail(r) });
  }
  if (conditions?.terrain) {
    const t = conditions.terrain;
    factors.push({ name: 'Slope', score: toInt(slopeFactor(t.slopeDeg) * 100), weight: 0.20, detail: `${formatFixed(t.slopeDeg, 0)}° mean slope` });
  }
  return combine(factors);
}

/** Inputs are `{ available: true, value }` or `{ available: false, reason }`. */
function locationRisk(optical, sar, rain, terrain, history) {
  const factors = [];
  if (terrain.available) {
    factors.push({ name: 'Slope', score: toInt(slopeFactor(terrain.value.slopeDeg) * 100), weight: 0.25, detail: `${formatFixed(terrain.value.slopeDeg, 0)}°` });
  }
  if (rain.available) {
    factors.push({ name: 'Rainfall', score: toInt(rainFactor(rain.value) * 100), weight: 0.30, detail: rainfallDetail(rain.value) });
  }
  if (history.available) {
    const f = clamp(history.value.eventsWithin10Km / 5.0, 0, 1);
    factors.push({ name: 'Landslide record', score: toInt(f * 100), weight: 0.25, detail: `${history.value.eventsWithin10Km} recorded within 10 km` });
  }
  if (optical.available && optical.value.baseline) {
    const d = optical.value.ndvi - optical.value.baseline.ndvi;
    const f = clamp(-d / 0.15, 0, 1);
    factors.push({ name: 'Vegetation loss (NDVI)', score: toInt(f * 100), weight: 0.12, detail: `${signed(d, 2)} vs. a year earlier` });
  }
  if (sar.available && sar.value.baselineVvDb != null) {
    const d = sar.value.vvDb - sar.value.baselineVvDb;
    const f = clamp((Math.abs(d) - 0.5) / 2.5, 0, 1);
    factors.push({ name: 'Surface change (SAR)', score: toInt(f * 100), weight: 0.08, detail: `${signed(d, 1)} dB vs. a year earlier` });
  }
  if (factors.reduce((sum, f) => sum + f.weight, 0) < 0.5) {
    return { available: false, reason: 'Not enough real data to compute a risk index here' };
  }
  return { available: true, value: combine(factors) };
}

function historyReading(events, lat, lng) {
  const withDistance = events.map((e) => [e, distanceKm(lat, lng, e.latitude, e.longitude)]);
  const near = withDistance.filter(([, d]) => d <= 10.0).map(([e]) => e);
  const nearDates = near.map((e) => e.dateMillis).filter((d) => d != null);
  return {
    eventsWithin10Km: near.length,
    fatalitiesWithin10Km: near.reduce((sum, e) => sum + (e.fatalities || 0), 0),
    nearestEventKm: withDistance.length ? Math.min(...withDistance.map(([, d]) => d)) : null,
    lastEventMillis: nearDates.length ? Math.max(...nearDates) : null,
  };
}

module.exports = {
  CLUSTER_RADIUS_KM,
  RAIN_SATURATION_MM,
  formatFixed,
  distanceKm,
  cluster,
  slopeFactor,
  rainFactor,
  hotspotRisk,
  locationRisk,
  historyReading,
};
