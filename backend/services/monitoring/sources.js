/**
 * Real public data sources used by the LandGuard monitoring engine. These are
 * ports of the Android clients (LandslideCatalogClient, OpenMeteoClient,
 * PlanetaryComputerClient, SatelliteAnalyzer) with identical queries, so the
 * backend and the app read exactly the same observations. Nothing here ever
 * substitutes, interpolates or simulates a value: a missing reading is
 * returned as `{ available: false, reason }`.
 */

const NORTHEAST = Object.freeze({
  STATES: ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'],
  MIN_LAT: 21.9,
  MAX_LAT: 29.5,
  MIN_LNG: 88.0,
  MAX_LNG: 97.5,
});

const contains = (lat, lng) => lat >= NORTHEAST.MIN_LAT && lat <= NORTHEAST.MAX_LAT && lng >= NORTHEAST.MIN_LNG && lng <= NORTHEAST.MAX_LNG;

const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class HttpStatusError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function requestJson(url, { method = 'GET', body, timeoutMs = 60_000 } = {}) {
  const attempt = async () => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new HttpStatusError(res.status, `HTTP ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };
  try {
    return await attempt();
  } catch (error) {
    // One retry for transient network failures — not for HTTP errors.
    if (error instanceof HttpStatusError) throw error;
    await sleep(1_500);
    return attempt();
  }
}

// ─────────────────────────────────────────────────────────────
// NASA Global Landslide Catalog (historical record — never "live")
// ─────────────────────────────────────────────────────────────

const CATALOG_SERVICES = [
  'https://services5.arcgis.com/XpkmJXTTH9PDa1gO/arcgis/rest/services/nasa_global_landslide_catalog_point/FeatureServer/0',
  'https://services9.arcgis.com/wb84GxCwiPzK3Eow/arcgis/rest/services/nasa_global_landslide_catalog_point/FeatureServer/0',
];

const CATALOG_FIELDS = [
  'event_id', 'event_date', 'event_title', 'location_description', 'location_accuracy',
  'landslide_category', 'landslide_trigger', 'landslide_size', 'fatality_count', 'injury_count',
  'latitude', 'longitude', 'admin_division_name', 'gazetteer_closest_point',
  'source_name', 'source_link',
].join(',');

const str = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v));
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function parseCatalogEvent(a) {
  if (!a) return null;
  const lat = num(a.latitude);
  const lng = num(a.longitude);
  const state = str(a.admin_division_name);
  if (lat === null || lng === null || state === null) return null;
  const date = num(a.event_date);
  return {
    id: str(a.event_id) ?? `${lat}_${lng}_${date}`,
    title: str(a.event_title) ?? 'Landslide',
    dateMillis: date === null ? null : Math.trunc(date),
    latitude: lat,
    longitude: lng,
    state,
    nearestPlace: str(a.gazetteer_closest_point),
    locationDescription: str(a.location_description),
    locationAccuracy: str(a.location_accuracy),
    category: str(a.landslide_category),
    trigger: str(a.landslide_trigger),
    size: str(a.landslide_size),
    fatalities: num(a.fatality_count) === null ? 0 : Math.trunc(num(a.fatality_count)),
    injuries: num(a.injury_count) === null ? 0 : Math.trunc(num(a.injury_count)),
    sourceName: str(a.source_name),
    sourceLink: str(a.source_link),
  };
}

async function queryCatalog(service) {
  const states = NORTHEAST.STATES.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
  const where = `country_name='India' AND admin_division_name IN (${states})`;
  const events = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      where,
      geometry: `${NORTHEAST.MIN_LNG},${NORTHEAST.MIN_LAT},${NORTHEAST.MAX_LNG},${NORTHEAST.MAX_LAT}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: CATALOG_FIELDS,
      returnGeometry: 'false',
      orderByFields: 'event_date DESC',
      resultOffset: String(offset),
      resultRecordCount: '1000',
      f: 'json',
    });
    const root = await requestJson(`${service}/query?${params}`);
    if (root.error) throw new Error(`Catalog query failed: ${root.error.message || JSON.stringify(root.error)}`);
    const features = root.features;
    if (!Array.isArray(features)) break;
    for (const f of features) {
      const event = parseCatalogEvent(f.attributes);
      if (event) events.push(event);
    }
    if (root.exceededTransferLimit !== true || features.length === 0) break;
    offset += features.length;
  }
  if (!events.length) throw new Error('Catalog returned no records');
  return events;
}

async function fetchNortheastCatalog() {
  let lastError = null;
  for (const service of CATALOG_SERVICES) {
    try {
      return { events: await queryCatalog(service), sourceUrl: service };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Landslide catalog unreachable');
}

// ─────────────────────────────────────────────────────────────
// Open-Meteo — rainfall / soil moisture (hourly models) and DEM slope
// ─────────────────────────────────────────────────────────────

const RAINFALL_SOURCE = 'Open-Meteo weather models (hourly)';
const OWM_SOURCE = 'OpenWeatherMap (fallback)';
const DEM_SOURCE = 'Copernicus GLO-90 DEM via Open-Meteo';
const BATCH_PAUSE_MS = 1_500;
const RATE_LIMIT_WAIT_MS = 61_000;
const OWM_API_KEY = process.env.OPENWEATHERMAP_API_KEY || process.env.OPENWEATHER_API_KEY || 'efdcd4be304dc9a480d622a2005be406';

async function withRateLimitRetry(block) {
  try {
    return await block();
  } catch (error) {
    if (!(error instanceof HttpStatusError) || error.status !== 429) throw error;
    if (String(error.message).includes('Daily API request limit exceeded')) {
      throw error; // Fast-fail to fallback
    }
    await sleep(RATE_LIMIT_WAIT_MS);
    return block();
  }
}

function parseRainfall(obj, nowMillis) {
  const hourly = obj?.hourly;
  const times = hourly?.time;
  const precipitation = hourly?.precipitation;
  if (!Array.isArray(times) || !Array.isArray(precipitation)) return null;
  const soil = hourly.soil_moisture_0_to_1cm;
  let past72 = 0;
  let next24 = 0;
  let pastHours = 0;
  let soilNow = null;
  const nowSec = Math.floor(nowMillis / 1000);
  for (let i = 0; i < times.length; i += 1) {
    const t = Number(times[i]);
    const p = precipitation[i];
    if (p === null || p === undefined) continue;
    if (t <= nowSec && t > nowSec - 72 * 3600) {
      past72 += p;
      pastHours += 1;
    } else if (t > nowSec && t <= nowSec + 24 * 3600) {
      next24 += p;
    }
    if (t <= nowSec && Array.isArray(soil) && soil[i] !== null && soil[i] !== undefined) soilNow = soil[i];
  }
  if (pastHours < 48) return null; // not enough observed hours to report a 72 h total honestly
  return { past72hMm: past72, next24hMm: next24, soilMoistureM3M3: soilNow, source: RAINFALL_SOURCE, fetchedAtMillis: nowMillis };
}

async function fetchOwmForecast(lat, lng) {
  if (!OWM_API_KEY) return null;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&appid=${OWM_API_KEY}&units=metric`;
  const root = await requestJson(url, { timeoutMs: 10_000 });
  const list = root?.list;
  if (!Array.isArray(list)) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  let next24 = 0;
  for (const item of list) {
    const t = Number(item.dt);
    if (t > nowSec && t <= nowSec + 24 * 3600) {
      next24 += Number(item.rain?.['3h'] || 0);
    }
  }
  return {
    past72hMm: 0,
    next24hMm: Number(next24.toFixed(1)),
    soilMoistureM3M3: null,
    source: OWM_SOURCE,
    fetchedAtMillis: Date.now(),
  };
}

async function rainfallOwmFallback(points) {
  const cache = new Map();
  const results = [];
  for (const [lat, lng] of points) {
    const cell = `${lat.toFixed(1)},${lng.toFixed(1)}`;
    if (!cache.has(cell)) {
      try {
        const reading = await fetchOwmForecast(lat, lng);
        cache.set(cell, reading);
        await sleep(100);
      } catch (err) {
        cache.set(cell, null);
      }
    }
    results.push(cache.get(cell));
  }
  return results;
}

async function rainfallChunk(points) {
  const params = new URLSearchParams({
    latitude: points.map(([lat]) => lat.toFixed(4)).join(','),
    longitude: points.map(([, lng]) => lng.toFixed(4)).join(','),
    hourly: 'precipitation,soil_moisture_0_to_1cm',
    past_days: '3',
    forecast_days: '2',
    timeformat: 'unixtime',
    timezone: 'GMT',
  });
  const root = await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const objects = Array.isArray(root) ? root : [root];
  const now = Date.now();
  return objects.map((o) => parseRainfall(o, now));
}

/** Rainfall + soil moisture for any number of points, with OpenWeatherMap fallback on 429. */
async function rainfall(points) {
  try {
    const out = [];
    for (let i = 0; i < points.length; i += 50) {
      if (i > 0) await sleep(BATCH_PAUSE_MS);
      out.push(...(await withRateLimitRetry(() => rainfallChunk(points.slice(i, i + 50)))));
    }
    return out;
  } catch (error) {
    const isRateLimited = (error instanceof HttpStatusError && error.status === 429) || String(error.message).includes('429');
    if (isRateLimited && OWM_API_KEY) {
      console.warn(`[Rainfall] Open-Meteo rate limit reached (HTTP 429). Falling back to OpenWeatherMap...`);
      return await rainfallOwmFallback(points);
    }
    throw error;
  }
}

async function elevationChunk(points) {
  const params = new URLSearchParams({
    latitude: points.map(([lat]) => lat.toFixed(5)).join(','),
    longitude: points.map(([, lng]) => lng.toFixed(5)).join(','),
  });
  const root = await requestJson(`https://api.open-meteo.com/v1/elevation?${params}`);
  const arr = root?.elevation;
  if (!Array.isArray(arr)) return points.map(() => null);
  return points.map((_, i) => (typeof arr[i] === 'number' && !Number.isNaN(arr[i]) ? arr[i] : null));
}

/** Elevation and slope from a 5-point DEM stencil (central differences). */
async function terrain(points, spacingM = 150.0) {
  const stencils = points.map(([lat, lng]) => {
    const dLat = spacingM / 111_320.0;
    const dLng = spacingM / (111_320.0 * Math.cos((lat * Math.PI) / 180));
    return [[lat, lng], [lat + dLat, lng], [lat - dLat, lng], [lat, lng + dLng], [lat, lng - dLng]];
  });
  const flat = stencils.flat();
  const elevations = [];
  for (let i = 0; i < flat.length; i += 100) {
    if (i > 0) await sleep(BATCH_PAUSE_MS);
    elevations.push(...(await withRateLimitRetry(() => elevationChunk(flat.slice(i, i + 100)))));
  }
  return stencils.map((_, i) => {
    const z = elevations.slice(i * 5, i * 5 + 5);
    if (z.length < 5 || z.some((v) => v === null)) return null;
    const [c, n, s, e, w] = z;
    const dzdx = (e - w) / (2 * spacingM);
    const dzdy = (n - s) / (2 * spacingM);
    const slope = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
    return { elevationM: c, slopeDeg: slope, source: DEM_SOURCE };
  });
}

// ─────────────────────────────────────────────────────────────
// Microsoft Planetary Computer — Sentinel-2 L2A / Sentinel-1 RTC
// ─────────────────────────────────────────────────────────────

const STAC_SEARCH = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const ITEM_STATISTICS = 'https://planetarycomputer.microsoft.com/api/data/v1/item/statistics';
const BOX_HALF_DEG = 0.01; // ≈ 2.2 km box
const MIN_CLEAR_FRACTION = 0.4;
const NDVI_MASKED_EXPRESSION =
  'where((SCL==4)|(SCL==5),(B08-B04)/(B08+B04),0);' +
  'where((SCL==4)|(SCL==5),1,0);' +
  'where((SCL>=4)&(SCL<=6),1,0)';

const isoUtc = (millis) => new Date(millis).toISOString().replace(/\.\d{3}Z$/, 'Z');

async function stacSearch({ collection, lat, lng, fromMillis, toMillis, limit, maxCloudCover, orbitState, relativeOrbit }) {
  const query = {};
  if (maxCloudCover != null) query['eo:cloud_cover'] = { lt: maxCloudCover };
  if (orbitState != null) query['sat:orbit_state'] = { eq: orbitState };
  if (relativeOrbit != null) query['sat:relative_orbit'] = { eq: relativeOrbit };
  const body = {
    collections: [collection],
    intersects: { type: 'Point', coordinates: [lng, lat] },
    datetime: `${isoUtc(fromMillis)}/${isoUtc(toMillis)}`,
    limit,
    sortby: [{ field: 'datetime', direction: 'desc' }],
    ...(Object.keys(query).length ? { query } : {}),
  };
  const root = await requestJson(STAC_SEARCH, { method: 'POST', body });
  return (root.features || []).flatMap((feature) => {
    const props = feature.properties;
    const acquired = props?.datetime ? Date.parse(props.datetime) : NaN;
    if (!feature.id || !Number.isFinite(acquired)) return [];
    return [{
      id: feature.id,
      collection,
      acquiredMillis: acquired,
      cloudCover: num(props['eo:cloud_cover']),
      orbitState: str(props['sat:orbit_state']),
      relativeOrbit: num(props['sat:relative_orbit']),
    }];
  });
}

function boxFeature(lat, lng, half) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[lng - half, lat - half], [lng + half, lat - half], [lng + half, lat + half], [lng - half, lat + half], [lng - half, lat - half]]],
    },
  };
}

async function boxStatistics(item, lat, lng, { expression, asset }) {
  const params = new URLSearchParams({ collection: item.collection, item: item.id, max_size: '256' });
  if (expression) { params.set('expression', expression); params.set('asset_as_band', 'true'); }
  if (asset) params.set('assets', asset);
  const root = await requestJson(`${ITEM_STATISTICS}?${params}`, { method: 'POST', body: boxFeature(lat, lng, BOX_HALF_DEG) });
  const stats = root?.properties?.statistics;
  if (!stats) throw new Error(`No statistics returned for ${item.id}`);
  return Object.values(stats);
}

async function meanOverBox(item, lat, lng, expression) {
  const bands = await boxStatistics(item, lat, lng, { expression });
  return bands.map((band) => {
    const valid = num(band.valid_pixels) ?? num(band.count) ?? 0;
    return valid <= 0 ? NaN : num(band.mean) ?? NaN;
  });
}

async function medianOverBox(item, lat, lng, asset) {
  const [band] = await boxStatistics(item, lat, lng, { asset });
  if (!band) throw new Error(`No statistics returned for ${item.id}`);
  return num(band.median) ?? NaN;
}

const formatDate = (millis) => new Date(millis).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function firstClearNdvi(items, lat, lng) {
  for (const item of items.slice(0, 6)) {
    const means = await meanOverBox(item, lat, lng, NDVI_MASKED_EXPRESSION);
    if (means.length < 3) continue;
    const [ndviSum, landFraction, clearFraction] = means;
    if ([ndviSum, landFraction, clearFraction].some(Number.isNaN)) continue;
    if (clearFraction >= MIN_CLEAR_FRACTION && landFraction >= 0.05) {
      return { item, ndvi: Math.min(1, Math.max(-1, ndviSum / landFraction)), clearFraction };
    }
  }
  return null;
}

async function optical(lat, lng, now = Date.now()) {
  const recent = await stacSearch({ collection: 'sentinel-2-l2a', lat, lng, fromMillis: now - 120 * DAY_MS, toMillis: now, limit: 12, maxCloudCover: 85.0 });
  if (!recent.length) return { available: false, reason: 'No Sentinel-2 scene over this location in the last 120 days' };
  const current = await firstClearNdvi(recent, lat, lng);
  if (!current) return { available: false, reason: `Recent Sentinel-2 passes are cloud-covered here (latest ${formatDate(recent[0].acquiredMillis)})` };
  let baseline = null;
  try {
    const candidates = await stacSearch({
      collection: 'sentinel-2-l2a', lat, lng,
      fromMillis: current.item.acquiredMillis - 395 * DAY_MS,
      toMillis: current.item.acquiredMillis - 335 * DAY_MS,
      limit: 10, maxCloudCover: 70.0,
    });
    const found = await firstClearNdvi(candidates, lat, lng);
    if (found) baseline = { sceneId: found.item.id, acquiredMillis: found.item.acquiredMillis, ndvi: found.ndvi };
  } catch { baseline = null; }
  return {
    available: true,
    value: {
      sceneId: current.item.id,
      acquiredMillis: current.item.acquiredMillis,
      clearFraction: current.clearFraction,
      ndvi: current.ndvi,
      baseline,
      ndviChange: baseline ? current.ndvi - baseline.ndvi : null,
      source: 'ESA Sentinel-2 L2A via Microsoft Planetary Computer',
    },
  };
}

async function sar(lat, lng, now = Date.now()) {
  const [latest] = await stacSearch({ collection: 'sentinel-1-rtc', lat, lng, fromMillis: now - 45 * DAY_MS, toMillis: now, limit: 1 });
  if (!latest) return { available: false, reason: 'No Sentinel-1 SAR pass over this location in the last 45 days' };
  const vv = await medianOverBox(latest, lat, lng, 'vv');
  if (Number.isNaN(vv) || vv <= 0) return { available: false, reason: 'Sentinel-1 scene has no valid pixels here' };
  let baseline = null;
  try {
    const [item] = await stacSearch({
      collection: 'sentinel-1-rtc', lat, lng,
      fromMillis: latest.acquiredMillis - 380 * DAY_MS,
      toMillis: latest.acquiredMillis - 350 * DAY_MS,
      limit: 1, orbitState: latest.orbitState, relativeOrbit: latest.relativeOrbit,
    });
    if (item) {
      const base = await medianOverBox(item, lat, lng, 'vv');
      if (!Number.isNaN(base) && base > 0) baseline = { acquiredMillis: item.acquiredMillis, vvDb: 10 * Math.log10(base) };
    }
  } catch { baseline = null; }
  const vvDb = 10 * Math.log10(vv);
  return {
    available: true,
    value: {
      sceneId: latest.id,
      acquiredMillis: latest.acquiredMillis,
      vvDb,
      baselineVvDb: baseline?.vvDb ?? null,
      baselineAcquiredMillis: baseline?.acquiredMillis ?? null,
      vvChangeDb: baseline ? vvDb - baseline.vvDb : null,
      source: 'ESA Sentinel-1 RTC (C-band SAR) via Microsoft Planetary Computer',
    },
  };
}

const ALOS4_UNAVAILABLE =
  'No public ALOS-4 PALSAR-3 data service is available to LandGuard. ' +
  'JAXA distributes ALOS-4 data through G-Portal to registered users only.';

module.exports = {
  NORTHEAST,
  contains,
  fetchNortheastCatalog,
  rainfall,
  terrain,
  optical,
  sar,
  ALOS4_UNAVAILABLE,
  RAINFALL_SOURCE,
  OWM_SOURCE,
  DEM_SOURCE,
};
