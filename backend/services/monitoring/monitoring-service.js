const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const analytics = require('./analytics');
const sources = require('./sources');

const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG_TTL_MS = 7 * DAY_MS;
const ANALYSIS_TTL_MS = 30 * 60 * 1000;
const LEVEL_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };

const iso = (millis) => (millis == null ? null : new Date(millis).toISOString());

/**
 * Single source of truth for regional monitoring. Monitored areas are
 * clusters of recorded landslides (NASA GLC) across the eight Northeast
 * states; live conditions are refreshed on a fixed cadence and every
 * snapshot carries its acquisition time. Previously fetched data survives
 * restarts on disk and is always labelled with its real age — never as live.
 *
 * Events: `updated` (summary) after each conditions refresh, `escalated`
 * (zones whose level rose to high/critical).
 */
class MonitoringService extends EventEmitter {
  constructor({ dataDir, refreshMinutes = 60, log = console } = {}) {
    super();
    this.cachePath = path.join(dataDir, 'monitoring-cache.json');
    this.refreshMs = Math.max(15, refreshMinutes) * 60 * 1000;
    this.log = log;
    this.catalog = null; // { events, sourceUrl, fetchedAtMillis }
    this.catalogFromCache = false;
    this.catalogError = null;
    this.hotspots = [];
    this.conditions = new Map(); // id -> { rainfall, terrain }
    this.terrainCache = {};
    this.conditionsUpdatedAtMillis = null;
    this.conditionsError = null;
    this.lastAttemptAtMillis = null;
    this.levels = new Map();
    this.analysisCache = new Map();
    this.refreshing = null;
    this.timers = [];
  }

  // ───────────────────────── lifecycle ─────────────────────────

  async start() {
    this.loadDiskCache();
    this.timers.push(setInterval(() => this.refresh().catch(() => {}), this.refreshMs));
    this.timers.forEach((t) => t.unref?.());
    await this.refresh().catch((error) => this.log.error('[Monitoring] Initial refresh failed:', error.message));
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  refresh({ force = false } = {}) {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        await this.refreshCatalog(force);
        await this.refreshConditions();
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  // ───────────────────────── catalog ─────────────────────────

  async refreshCatalog(force = false) {
    const fresh = this.catalog && Date.now() - this.catalog.fetchedAtMillis < CATALOG_TTL_MS;
    if (!force && fresh) return;
    try {
      const { events, sourceUrl } = await sources.fetchNortheastCatalog();
      this.catalog = { events, sourceUrl, fetchedAtMillis: Date.now() };
      this.catalogFromCache = false;
      this.catalogError = null;
      this.hotspots = analytics.cluster(events);
      this.log.log(`[Monitoring] NASA GLC catalog: ${events.length} events → ${this.hotspots.length} monitored areas`);
      this.persist();
    } catch (error) {
      this.catalogError = error.message;
      this.log.error(`[Monitoring] Catalog refresh failed: ${error.message}${this.catalog ? ' (keeping previously downloaded catalog, labelled cached)' : ''}`);
      if (this.catalog) this.catalogFromCache = true;
    }
  }

  // ───────────────────────── conditions ─────────────────────────

  async refreshConditions() {
    if (!this.hotspots.length) return;
    this.lastAttemptAtMillis = Date.now();
    const points = this.hotspots.map((h) => [h.latitude, h.longitude]);
    let rain = null;
    try {
      rain = await sources.rainfall(points);
      this.conditionsError = null;
    } catch (error) {
      this.conditionsError = `Rainfall unavailable: ${error.message}`;
      this.log.error(`[Monitoring] ${this.conditionsError}`);
    }

    const missingTerrain = this.hotspots.filter((h) => !this.terrainCache[h.id]);
    if (missingTerrain.length) {
      try {
        const readings = await sources.terrain(missingTerrain.map((h) => [h.latitude, h.longitude]));
        readings.forEach((reading, i) => { if (reading) this.terrainCache[missingTerrain[i].id] = reading; });
      } catch (error) {
        this.log.error(`[Monitoring] Terrain refresh failed: ${error.message}`);
      }
    }

    if (!rain) {
      // Keep the last real conditions (with their original timestamps).
      this.persist();
      return;
    }
    const next = new Map();
    this.hotspots.forEach((h, i) => next.set(h.id, { rainfall: rain[i] || null, terrain: this.terrainCache[h.id] || null }));
    this.conditions = next;
    this.conditionsUpdatedAtMillis = Date.now();
    this.persist();

    const escalations = [];
    for (const zone of this.zones()) {
      const previous = this.levels.get(zone.id);
      if (previous && LEVEL_RANK[zone.risk.level] > LEVEL_RANK[previous] && LEVEL_RANK[zone.risk.level] >= LEVEL_RANK.high) {
        escalations.push({ id: zone.id, name: zone.name, from: previous, to: zone.risk.level, score: zone.risk.score });
      }
      this.levels.set(zone.id, zone.risk.level);
    }
    this.emit('updated', this.summary());
    if (escalations.length) this.emit('escalated', escalations);
  }

  // ───────────────────────── read models ─────────────────────────

  conditionsState() {
    if (!this.conditionsUpdatedAtMillis) return 'unavailable';
    const age = Date.now() - this.conditionsUpdatedAtMillis;
    return age <= this.refreshMs * 1.5 + 5 * 60 * 1000 ? 'live' : 'stale';
  }

  serializeZone(h) {
    const c = this.conditions.get(h.id) || { rainfall: null, terrain: this.terrainCache[h.id] || null };
    const risk = analytics.hotspotRisk(h, c);
    return {
      id: h.id,
      name: h.name,
      state: h.state,
      lat: h.latitude,
      lng: h.longitude,
      eventCount: h.eventCount,
      fatalities: h.fatalities,
      firstEventMillis: h.firstEventMillis,
      lastEventMillis: h.lastEventMillis,
      firstEventAt: iso(h.firstEventMillis),
      lastEventAt: iso(h.lastEventMillis),
      dominantTrigger: h.dominantTrigger,
      risk: { ...risk, severity: risk.level.toUpperCase() },
      rainfall: c.rainfall ? { ...c.rainfall, observedAt: iso(c.rainfall.fetchedAtMillis) } : null,
      terrain: c.terrain || null,
    };
  }

  zones() {
    return this.hotspots.map((h) => this.serializeZone(h));
  }

  zone(id) {
    const h = this.hotspots.find((item) => item.id === id);
    if (!h) return null;
    return { ...this.serializeZone(h), events: h.events };
  }

  catalogPayload() {
    if (!this.catalog) return null;
    return {
      sourceUrl: this.catalog.sourceUrl,
      fetchedAtMillis: this.catalog.fetchedAtMillis,
      fetchedAt: iso(this.catalog.fetchedAtMillis),
      fromCache: this.catalogFromCache,
      events: this.catalog.events,
    };
  }

  summary() {
    const zones = this.zones();
    const byLevel = { low: 0, moderate: 0, high: 0, critical: 0 };
    zones.forEach((z) => { byLevel[z.risk.level] += 1; });
    return {
      region: { name: 'Northeast India', states: sources.NORTHEAST.STATES, bounds: { minLat: sources.NORTHEAST.MIN_LAT, maxLat: sources.NORTHEAST.MAX_LAT, minLng: sources.NORTHEAST.MIN_LNG, maxLng: sources.NORTHEAST.MAX_LNG } },
      zones: zones.length,
      byLevel,
      catalog: this.catalog
        ? { events: this.catalog.events.length, fetchedAt: iso(this.catalog.fetchedAtMillis), fromCache: this.catalogFromCache, source: 'NASA Global Landslide Catalog', error: this.catalogError }
        : { events: 0, fetchedAt: null, fromCache: false, source: 'NASA Global Landslide Catalog', error: this.catalogError || 'Not loaded yet' },
      conditions: {
        state: this.conditionsState(),
        observedAt: iso(this.conditionsUpdatedAtMillis),
        lastAttemptAt: iso(this.lastAttemptAtMillis),
        refreshMinutes: Math.round(this.refreshMs / 60000),
        error: this.conditionsError,
        rainfallSource: sources.RAINFALL_SOURCE,
        terrainSource: sources.DEM_SOURCE,
        zonesWithRainfall: zones.filter((z) => z.rainfall).length,
        zonesWithTerrain: zones.filter((z) => z.terrain).length,
      },
      satellite: {
        sentinel2: 'On-demand per zone/location (Microsoft Planetary Computer)',
        sentinel1: 'On-demand per zone/location (Microsoft Planetary Computer)',
        alos4: sources.ALOS4_UNAVAILABLE,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /** Point analysis — the same inputs and model as the Android location analysis. */
  async analyze(lat, lng, { force = false } = {}) {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const cached = this.analysisCache.get(key);
    if (!force && cached && Date.now() - cached.analysedAtMillis < ANALYSIS_TTL_MS) return cached;

    const safely = async (label, block) => {
      try {
        return await block();
      } catch (error) {
        return { available: false, reason: `${label} data unavailable (${String(error.message || 'request failed').slice(0, 80)})` };
      }
    };
    const [optical, sar, rain, terrain] = await Promise.all([
      safely('Sentinel-2', () => sources.optical(lat, lng)),
      safely('Sentinel-1', () => sources.sar(lat, lng)),
      safely('Rainfall', async () => {
        const [reading] = await sources.rainfall([[lat, lng]]);
        return reading ? { available: true, value: reading } : { available: false, reason: 'Rainfall data unavailable for this location' };
      }),
      safely('Terrain', async () => {
        const [reading] = await sources.terrain([[lat, lng]]);
        return reading ? { available: true, value: reading } : { available: false, reason: 'Elevation data unavailable for this location' };
      }),
    ]);
    const history = this.catalog
      ? { available: true, value: analytics.historyReading(this.catalog.events, lat, lng) }
      : { available: false, reason: 'Landslide catalog not loaded' };
    const risk = analytics.locationRisk(optical, sar, rain, terrain, history);
    const result = {
      latitude: lat,
      longitude: lng,
      analysedAtMillis: Date.now(),
      analysedAt: new Date().toISOString(),
      optical,
      sar,
      alos4: { available: false, reason: sources.ALOS4_UNAVAILABLE },
      rainfall: rain,
      terrain,
      history,
      risk: risk.available ? { available: true, value: { ...risk.value, severity: risk.value.level.toUpperCase() } } : risk,
    };
    this.analysisCache.set(key, result);
    if (this.analysisCache.size > 500) this.analysisCache.delete(this.analysisCache.keys().next().value);
    return result;
  }

  // ───────────────────────── disk cache ─────────────────────────

  loadDiskCache() {
    let saved = null;
    try {
      if (fs.existsSync(this.cachePath)) {
        saved = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.log.error(`[Monitoring] Ignoring unreadable cache: ${error.message}`);
    }

    if (!saved || !saved.catalog) {
      const seedPath = path.join(__dirname, 'seed-cache.json');
      try {
        if (fs.existsSync(seedPath)) {
          saved = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
          this.log.log('[Monitoring] Initialized from bundled seed-cache.json');
        }
      } catch (error) {
        this.log.error(`[Monitoring] Could not load bundled seed cache: ${error.message}`);
      }
    }

    if (saved) {
      if (Array.isArray(saved.catalog?.events) && saved.catalog.events.length) {
        this.catalog = saved.catalog;
        this.catalogFromCache = true;
        this.hotspots = analytics.cluster(saved.catalog.events);
      }
      this.terrainCache = saved.terrainCache || {};
      if (saved.conditionsUpdatedAtMillis && saved.conditions) {
        this.conditions = new Map(Object.entries(saved.conditions));
        this.conditionsUpdatedAtMillis = saved.conditionsUpdatedAtMillis;
      }
      this.zones().forEach((z) => this.levels.set(z.id, z.risk.level));
      this.log.log(`[Monitoring] Loaded cached monitoring data (${this.hotspots.length} areas, conditions ${iso(this.conditionsUpdatedAtMillis) || 'none'})`);
    }
  }

  persist() {
    try {
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      const tmp = `${this.cachePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({
        catalog: this.catalog,
        terrainCache: this.terrainCache,
        conditions: Object.fromEntries(this.conditions),
        conditionsUpdatedAtMillis: this.conditionsUpdatedAtMillis,
      }));
      fs.renameSync(tmp, this.cachePath);
    } catch (error) {
      this.log.error(`[Monitoring] Could not persist cache: ${error.message}`);
    }
  }
}

module.exports = { MonitoringService };
