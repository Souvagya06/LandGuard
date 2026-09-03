from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen
import json
import math

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class AlertRequest(BaseModel):
	zoneId: str


class ReportRequest(BaseModel):
	zoneId: str
	zoneName: str
	note: str
	photoDataUrl: str | None = None
	lat: float
	lng: float


ZONE_SEEDS = [
	("z1", "Sohra Ridge", "East Khasi Hills", 25.2793, 91.7362, 30, "blocked"),
	("z2", "Cherra Hill", "East Khasi Hills", 25.2989, 91.5822, 27, "restricted"),
	("z3", "Ukhrul Slope", "Ukhrul", 25.0489, 94.3617, 22, "restricted"),
	("z4", "Along Road", "West Siang", 28.1667, 94.8, 15, "open"),
	("z5", "Ziro Valley", "Lower Subansiri", 27.55, 93.83, 10, "open"),
	("z6", "Aizawl East", "Aizawl", 23.7307, 92.7176, 9, "open"),
	("z7", "Kohima North", "Kohima", 25.6747, 94.1086, 8, "open"),
	("z8", "Dimapur Flats", "Dimapur", 25.9091, 93.7266, 2, "open"),
]
alerts: list[dict[str, Any]] = []


def risk_level(score: int) -> str:
	if score >= 75: return "critical"
	if score >= 55: return "high"
	if score >= 30: return "moderate"
	return "low"


def live_weather(lat: float, lng: float) -> dict[str, Any]:
	query = urlencode({"latitude": lat, "longitude": lng, "hourly": "precipitation", "forecast_days": 7, "timezone": "UTC"})
	try:
		with urlopen(f"https://api.open-meteo.com/v1/forecast?{query}", timeout=8) as response:
			return json.load(response)
	except Exception as exc:
		raise HTTPException(status_code=503, detail=f"Live weather service unavailable: {exc}") from exc


def build_zone(seed: tuple[Any, ...]) -> dict[str, Any]:
	zone_id, name, district, lat, lng, slope, road = seed
	weather = live_weather(lat, lng)
	precipitation = weather.get("hourly", {}).get("precipitation", [])
	rainfall_24h = round(sum(precipitation[-24:]), 1)
	rainfall_7d = round(sum(precipitation), 1)
	rainfall_score = min(60, round(rainfall_24h * 0.8 + rainfall_7d * 0.08))
	score = min(99, max(1, rainfall_score + slope + (8 if road == "blocked" else 4 if road == "restricted" else 0)))
	level = risk_level(score)
	return {
		"id": zone_id, "name": name, "district": district, "lat": lat, "lng": lng,
		"riskScore": score, "riskLevel": level, "rainfall24h": rainfall_24h, "rainfall7d": rainfall_7d,
		"roadStatus": road, "factors": [
			{"label": "Rainfall (24h + 7d)", "value": rainfall_score},
			{"label": "Slope angle", "value": slope},
			{"label": "Historical density", "value": max(2, round(slope * 0.6))},
			{"label": "Vegetation loss", "value": max(1, round(slope * 0.3))},
		], "updatedAt": datetime.now(timezone.utc).isoformat(),
	}


app = FastAPI(title="LandGuard live risk API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}


@app.get("/zones")
def get_zones() -> list[dict[str, Any]]:
	return [build_zone(seed) for seed in ZONE_SEEDS]


@app.get("/zones/{zone_id}")
def get_zone(zone_id: str) -> dict[str, Any]:
	seed = next((item for item in ZONE_SEEDS if item[0] == zone_id), None)
	if not seed: raise HTTPException(status_code=404, detail="Zone not found")
	return build_zone(seed)


@app.get("/alerts")
def get_alerts() -> list[dict[str, Any]]:
	return alerts


@app.post("/alerts")
def create_alert(request: AlertRequest) -> dict[str, Any]:
	zone = get_zone(request.zoneId)
	alert = {"id": f"a-{math.floor(datetime.now().timestamp() * 1000)}", "zoneId": zone["id"], "zoneName": zone["name"], "level": zone["riskLevel"], "message": f"{zone['riskLevel'].title()} landslide risk near {zone['name']}. Take precaution.", "channel": "dashboard", "createdAt": datetime.now(timezone.utc).isoformat()}
	alerts.insert(0, alert)
	return alert


@app.post("/reports")
def create_report(request: ReportRequest) -> dict[str, Any]:
	return {"ok": True, "id": f"r-{math.floor(datetime.now().timestamp() * 1000)}", "zoneId": request.zoneId}
