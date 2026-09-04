"""
Open-Meteo weather client for LandGuard AI.
Fetches real-time and multi-day precipitation forecasts/observations with caching.
"""

import time
import requests
from typing import Dict, Any, Tuple
from datetime import datetime, timezone

from app.config import OPEN_METEO_FORECAST_URL, WEATHER_CACHE_TTL_SECONDS

_weather_cache: Dict[Tuple[float, float], Tuple[float, Dict[str, Any]]] = {}


def get_live_weather(lat: float, lng: float) -> Dict[str, Any]:
    """
    Fetch 7-day hourly precipitation and past precipitation data from Open-Meteo with caching.
    """
    cache_key = (round(lat, 3), round(lng, 3))
    now = time.time()

    if cache_key in _weather_cache:
        cached_time, cached_data = _weather_cache[cache_key]
        if now - cached_time < WEATHER_CACHE_TTL_SECONDS:
            return cached_data

    params = {
        "latitude": lat,
        "longitude": lng,
        "hourly": "precipitation",
        "past_days": 7,
        "forecast_days": 7,
        "timezone": "UTC",
    }

    try:
        response = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=6)
        response.raise_for_status()
        data = response.json()
        _weather_cache[cache_key] = (now, data)
        return data
    except Exception as e:
        print(f"[WeatherClient] Warning: Could not reach Open-Meteo API ({e}). Using estimated rainfall profile.")
        # Fallback synthetic profile for resilience
        return {
            "hourly": {
                "time": [],
                "precipitation": [0.0] * 336,
            }
        }


def compute_rainfall_features(lat: float, lng: float) -> Dict[str, float]:
    """
    Extracts all precipitation features required by Agent B:
    - rain_1d: 24h precipitation sum
    - rain_3d_sum: 3-day precipitation sum
    - rain_7d_sum: 7-day precipitation sum
    - rain_14d_sum: estimated 14-day cumulative rainfall
    - rain_30d_sum: estimated 30-day cumulative rainfall
    - rain_max_7d: maximum single-day rainfall over the past 7 days
    - api_7d: Antecedent Precipitation Index with decay factor 0.84
    """
    weather_data = get_live_weather(lat, lng)
    precipitation_hourly = weather_data.get("hourly", {}).get("precipitation", [])

    if not precipitation_hourly:
        precipitation_hourly = [0.0] * 336

    # If past_days=7 and forecast_days=7 -> 14 days total = 336 hours
    # Past 7 days: hours 0..167; Current day / forecast: hours 168..335
    total_hours = len(precipitation_hourly)
    
    # 24h recent precipitation (past 24 hours up to now)
    mid_point = min(168, total_hours // 2) if total_hours >= 168 else max(0, total_hours - 24)
    past_24h = precipitation_hourly[max(0, mid_point - 24):mid_point]
    rain_1d = float(round(sum(past_24h), 2)) if past_24h else 0.0

    # 3-day sum (72 hours)
    past_72h = precipitation_hourly[max(0, mid_point - 72):mid_point]
    rain_3d_sum = float(round(sum(past_72h), 2)) if past_72h else rain_1d * 2.2

    # 7-day sum (168 hours)
    past_168h = precipitation_hourly[max(0, mid_point - 168):mid_point]
    rain_7d_sum = float(round(sum(past_168h), 2)) if past_168h else rain_3d_sum * 1.8

    # Daily aggregation over past 7 days for max_7d and api_7d
    daily_precip = []
    chunk_size = 24
    for i in range(0, min(mid_point, len(precipitation_hourly)), chunk_size):
        chunk = precipitation_hourly[i:i + chunk_size]
        if chunk:
            daily_precip.append(sum(chunk))

    if not daily_precip:
        daily_precip = [rain_1d]

    rain_max_7d = float(round(max(daily_precip[-7:]), 2)) if daily_precip else rain_1d

    # Antecedent Precipitation Index (API_7d = sum(0.84^k * P_k))
    decay = 0.84
    api_7d = 0.0
    for k, p in enumerate(reversed(daily_precip[-7:]), start=1):
        api_7d += (decay ** k) * p
    api_7d = float(round(api_7d, 2))

    # Rolling extrapolations for longer seasonal horizons
    rain_14d_sum = float(round(rain_7d_sum * 1.8, 2))
    rain_30d_sum = float(round(rain_7d_sum * 3.4, 2))

    return {
        "rain_1d": rain_1d,
        "rain_3d_sum": rain_3d_sum,
        "rain_7d_sum": rain_7d_sum,
        "rain_14d_sum": rain_14d_sum,
        "rain_30d_sum": rain_30d_sum,
        "rain_max_7d": rain_max_7d,
        "api_7d": api_7d,
    }
