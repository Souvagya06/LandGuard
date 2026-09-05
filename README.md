# LandGuard AI

LandGuard AI is an AI-assisted landslide early-warning and risk-monitoring platform for North East India. It combines terrain, satellite, rainfall, and historical landslide information to help authorities and field teams identify vulnerable slopes, understand risk drivers, and coordinate early action.

The project includes a live web dashboard, a Node.js risk API, a dual-agent risk engine, and an offline machine-learning pipeline for preparing data and training models.

## Features

- Interactive map of monitored locations.
- Live landslide risk rate for each location.
- Map markers coloured by landslide risk rate.
- Two-stage AI that separates terrain susceptibility from rainfall-triggered risk.
- Location-level rainfall, terrain, ground-disturbance, road-status, and factor-breakdown views.
- Operational advisory explaining the main risk drivers.
- Dashboard alerts and field-report submission.
- Resilient fallback rainfall profile when live weather data is unavailable.

## System architecture

```text
Geospatial and weather data
SRTM + Sentinel-1 + Sentinel-2 + Open-Meteo + historical landslide records
                                  |
                                  v
Feature engineering
Terrain, vegetation, ground disturbance, and rainfall-window features
                                  |
                                  v
Dual-agent risk engine
Agent A: terrain susceptibility     Agent B: rainfall trigger probability
                                  |
                                  v
Risk fusion and explainability
Risk rate, risk level, contributing factors, and advisory
                                  |
                                  v
Node.js / Express API
Zones, predictions, alerts, and field reports
                                  |
                                  v
React dashboard
Risk map, analytics, alert console, and field reporting
```

## Risk model

### Agent A: Terrain susceptibility

Agent A estimates baseline slope vulnerability from spatial features:

- Elevation, slope angle, and aspect
- NDVI vegetation health
- Sentinel-1 SAR ground disturbance
- VV and VH backscatter-change features

### Agent B: Rainfall trigger probability

Agent B combines Agent A's susceptibility result with dynamic rainfall indicators:

- Rainfall in the previous 24 hours
- 3-day, 7-day, 14-day, and 30-day rainfall accumulation
- Maximum daily rainfall in the previous 7 days
- 7-day Antecedent Precipitation Index (API)

### Final risk rate

The platform combines susceptibility, trigger probability, and road status to produce the operational risk score. The dashboard also calculates a live landslide risk rate from rainfall intensity, 7-day rainfall accumulation, ground disturbance, and terrain susceptibility.

| Landslide risk rate | Dashboard level | Map colour |
| --- | --- | --- |
| Below 25% | Low | Green |
| 25% to 49% | Moderate | Amber |
| 50% to 74% | High | Orange |
| 75% and above | Critical | Red |

## Data sources

| Source | Purpose in LandGuard |
| --- | --- |
| SRTM DEM | Elevation, slope, and aspect |
| Sentinel-1 SAR | Ground-disturbance and backscatter-change indicators |
| Sentinel-2 L2A | NDVI for vegetation health and canopy cover |
| Open-Meteo | Historical and live precipitation data |
| NASA Global Landslide Catalog | Historical event records and labels |

The current processed training table contains 122,784 feature records spanning 2019 to 2026 across three pilot monitoring zones.

## Technology stack

### Frontend

- React 19, TypeScript, and Vite
- TanStack Query
- React Leaflet with OpenStreetMap tiles
- Recharts and Tailwind CSS

### Backend

- Node.js and Express
- CORS middleware

### Offline ML and geospatial pipeline

- Python, pandas, NumPy, and scikit-learn
- rasterio and requests
- Google Earth Engine and geemap for Sentinel-1 extraction
- Microsoft Planetary Computer STAC for Sentinel-2 imagery

## Repository structure

```text
landguard-ai/
├── backend/
│   ├── server.js                  # Express API and live weather integration
│   └── services/                  # Risk engine and monitoring locations
├── frontend/
│   ├── src/components/            # Map, analysis, layout, and zone panel
│   ├── src/pages/                 # Dashboard, alerts, and alert console
│   ├── src/lib/                   # API client and risk helpers
│   └── public/                    # Static assets
├── ml/
│   ├── data/raw/                  # Source rasters and downloaded data
│   ├── data/processed/            # Unified feature table
│   ├── models/                    # Trained model artifacts
│   ├── notebooks/                 # Data and training notebooks
│   └── scripts/                   # Fetching, features, training, inference
└── docs/                          # Documentation and demo material
```

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service health and runtime information |
| `GET` | `/zones` | All monitored locations with live risk data |
| `GET` | `/zones/:id` | One monitored location |
| `POST` | `/predict` | On-demand prediction for a location or simulation payload |
| `GET` | `/alerts` | Alert history for the running session |
| `POST` | `/alerts` | Create an alert for a monitored location |
| `GET` | `/reports` | Field reports for the running session |
| `POST` | `/reports` | Submit a field report |

### Example prediction request

```json
{
  "lat": 27.5,
  "lng": 93.8,
  "elevation_m": 1000,
  "slope_deg": 30,
  "ndvi": 0.52,
  "sar_disturbance": 0.6,
  "rain_1d": 45,
  "rain_7d_sum": 150,
  "roadStatus": "restricted"
}
```

## Run the application

### Prerequisites

- Node.js 18 or later
- npm
- Python 3.10 or later for the offline ML pipeline

### Start the frontend in development mode

```bash
cd frontend
npm install
npm run dev
```

The development server normally starts at `http://127.0.0.1:5173`.

### Start the backend API

```bash
cd backend
npm install
npm start
```

The API starts at `http://127.0.0.1:8000`.

### Build and serve the frontend through the backend

```bash
cd frontend
npm run build

cd ../backend
npm start
```

Then open `http://127.0.0.1:8000/dashboard.html`.

## ML data and training workflow

Run the offline pipeline from `ml/scripts` after installing the required Python packages.

```bash
# 1. Derive slope and aspect from downloaded DEM files
python fetch_terrain.py

# 2. Download or prepare satellite, rainfall, and historical landslide data
python fetch_rainfall_history.py
python fetch_ndvi.py
python fetch_ground_disturbance.py --before-start 2024-11-01 --before-end 2025-02-28 --after-start 2025-11-01 --after-end 2026-02-28
python fetch_landslide_catalog.py

# 3. Build the unified feature table
python build_feature_table.py

# 4. Train Agent A, then Agent B
python train_agent_a.py
python train_agent_b.py
```

The training scripts store model artifacts in `ml/models/`. Offline training uses scikit-learn `HistGradientBoostingClassifier` models. The deployed Node.js API uses a portable JavaScript implementation of the two-stage risk logic, so it does not require a Python runtime at inference time.

## Dashboard behaviour

- Zone data refreshes every 15 seconds.
- The backend caches weather responses for 10 minutes.
- The backend fetches weather for all monitored locations in one batch when `/zones` is called.
- If Open-Meteo is unavailable, LandGuard uses a deterministic fallback rainfall profile so the dashboard remains operational.
- The frontend uses bundled fallback zone data if the API cannot be reached.

## Current prototype scope

LandGuard is a working decision-support prototype, not a replacement for formal disaster warnings or geotechnical inspection. Alerts and reports use in-memory storage in the current build. A production release should add persistent storage, authentication, role-based access, audit logs, localized alert channels, field validation, and calibration with disaster-management authorities.

## Future improvements

- Persistent databases for alerts, reports, and monitoring history.
- SMS, mobile-push, and multilingual alert delivery.
- Offline-first field reporting for low-connectivity areas.
- IoT sensor integration where available.
- Model retraining and calibration using verified local events.
- Geofencing, evacuation routes, uncertainty estimates, and audit trails.

## License

This project is intended for academic, hackathon, and research use. Add a formal license before public or commercial deployment.
