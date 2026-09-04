const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json({ limit: '10mb' })); // limit raised for photoDataUrl base64 payloads
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
  })
);

// ---- Zone seed data: [id, name, district, lat, lng, slope, roadStatus] ----
const ZONE_SEEDS = [
  ['z1', 'Sohra Ridge', 'East Khasi Hills', 25.2793, 91.7362, 30, 'blocked'],
  ['z2', 'Cherra Hill', 'East Khasi Hills', 25.2989, 91.5822, 27, 'restricted'],
  ['z3', 'Ukhrul Slope', 'Ukhrul', 25.0489, 94.3617, 22, 'restricted'],
  ['z4', 'Along Road', 'West Siang', 28.1667, 94.8, 15, 'open'],
  ['z5', 'Ziro Valley', 'Lower Subansiri', 27.55, 93.83, 10, 'open'],
  ['z6', 'Aizawl East', 'Aizawl', 23.7307, 92.7176, 9, 'open'],
  ['z7', 'Kohima North', 'Kohima', 25.6747, 94.1086, 8, 'open'],
  ['z8', 'Dimapur Flats', 'Dimapur', 25.9091, 93.7266, 2, 'open'],
];

/** @type {Array<Record<string, any>>} */
const alerts = [];

function riskLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

async function liveWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: 'precipitation',
    forecast_days: '7',
    timezone: 'UTC',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Upstream status ${res.status}`);
    return await res.json();
  } catch (err) {
    const error = new Error(`Live weather service unavailable: ${err.message}`);
    error.statusCode = 503;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildZone(seed) {
  const [zoneId, name, district, lat, lng, slope, road] = seed;
  const weather = await liveWeather(lat, lng);
  const precipitation = weather?.hourly?.precipitation ?? [];

  const round1 = (n) => Math.round(n * 10) / 10;
  const rainfall24h = round1(precipitation.slice(-24).reduce((a, b) => a + b, 0));
  const rainfall7d = round1(precipitation.reduce((a, b) => a + b, 0));
  const rainfallScore = Math.min(60, Math.round(rainfall24h * 0.8 + rainfall7d * 0.08));
  const roadBonus = road === 'blocked' ? 8 : road === 'restricted' ? 4 : 0;
  const score = Math.min(99, Math.max(1, rainfallScore + slope + roadBonus));
  const level = riskLevel(score);

  return {
    id: zoneId,
    name,
    district,
    lat,
    lng,
    riskScore: score,
    riskLevel: level,
    rainfall24h,
    rainfall7d,
    roadStatus: road,
    factors: [
      { label: 'Rainfall (24h + 7d)', value: rainfallScore },
      { label: 'Slope angle', value: slope },
      { label: 'Historical density', value: Math.max(2, Math.round(slope * 0.6)) },
      { label: 'Vegetation loss', value: Math.max(1, Math.round(slope * 0.3)) },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function findSeed(zoneId) {
  return ZONE_SEEDS.find((s) => s[0] === zoneId);
}

// ---- Routes ----

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/zones', async (req, res, next) => {
  try {
    const zones = await Promise.all(ZONE_SEEDS.map(buildZone));
    res.json(zones);
  } catch (err) {
    next(err);
  }
});

app.get('/zones/:id', async (req, res, next) => {
  try {
    const seed = findSeed(req.params.id);
    if (!seed) return res.status(404).json({ detail: 'Zone not found' });
    res.json(await buildZone(seed));
  } catch (err) {
    next(err);
  }
});

app.get('/alerts', (req, res) => {
  res.json(alerts);
});

app.post('/alerts', async (req, res, next) => {
  try {
    const { zoneId } = req.body ?? {};
    const seed = findSeed(zoneId);
    if (!seed) return res.status(404).json({ detail: 'Zone not found' });

    const zone = await buildZone(seed);
    const alert = {
      id: `a-${Date.now()}`,
      zoneId: zone.id,
      zoneName: zone.name,
      level: zone.riskLevel,
      message: `${zone.riskLevel[0].toUpperCase()}${zone.riskLevel.slice(1)} landslide risk near ${zone.name}. Take precaution.`,
      channel: 'dashboard',
      createdAt: new Date().toISOString(),
    };
    alerts.unshift(alert);
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

app.post('/reports', (req, res) => {
  const { zoneId } = req.body ?? {};
  res.json({ ok: true, id: `r-${Date.now()}`, zoneId });
});

// ---- Error handler (mirrors FastAPI's {detail} shape) ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ detail: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LandGuard Node backend running on http://127.0.0.1:${PORT}`);
});