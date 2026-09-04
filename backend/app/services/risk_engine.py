"""
Dual-Agent ML Risk Engine for LandGuard AI.
Integrates:
- Agent A: Static Spatial Geomorphology Susceptibility Model (HistGradientBoosting)
- Agent B: Dynamic Multi-Hazard Rainfall Trigger Model (HistGradientBoosting)
"""

import os
import pickle
import math
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from datetime import datetime, timezone

from app.config import (
    AGENT_A_MODEL_PATH,
    AGENT_B_MODEL_PATH,
    FEATURE_TABLE_PATH,
)
from app.services.weather_client import compute_rainfall_features
from app.services.explain import compute_factor_breakdown, generate_narrative_explanation


# Regional and district monitoring zones
REGISTERED_ZONES: List[Dict[str, Any]] = [
    {
        "id": "lower_subansiri_arunachal_pradesh",
        "name": "Ziro Valley Slopes",
        "district": "Lower Subansiri, Arunachal Pradesh",
        "lat": 27.5500,
        "lng": 93.8300,
        "elevation_m": 1580.0,
        "slope_deg": 24.5,
        "aspect_deg": 180.0,
        "ndvi": 0.68,
        "sar_disturbance": 0.68,
        "sar_vv_change": 0.45,
        "sar_vh_change": 0.52,
        "roadStatus": "open",
    },
    {
        "id": "papum_pare_arunachal_pradesh",
        "name": "Itanagar Hills",
        "district": "Papum Pare, Arunachal Pradesh",
        "lat": 27.0844,
        "lng": 93.6053,
        "elevation_m": 750.0,
        "slope_deg": 28.2,
        "aspect_deg": 210.0,
        "ndvi": 0.52,
        "sar_disturbance": 0.46,
        "sar_vv_change": 0.38,
        "sar_vh_change": 0.41,
        "roadStatus": "restricted",
    },
    {
        "id": "west_siang_arunachal_pradesh",
        "name": "Aalo Highway Sector",
        "district": "West Siang, Arunachal Pradesh",
        "lat": 28.1667,
        "lng": 94.8000,
        "elevation_m": 610.0,
        "slope_deg": 32.8,
        "aspect_deg": 140.0,
        "ndvi": 0.48,
        "sar_disturbance": 0.76,
        "sar_vv_change": 0.55,
        "sar_vh_change": 0.62,
        "roadStatus": "blocked",
    },
    {
        "id": "z1_sohra_ridge",
        "name": "Sohra Ridge",
        "district": "East Khasi Hills, Meghalaya",
        "lat": 25.2793,
        "lng": 91.7362,
        "elevation_m": 1430.0,
        "slope_deg": 36.5,
        "aspect_deg": 165.0,
        "ndvi": 0.45,
        "sar_disturbance": 0.82,
        "sar_vv_change": 0.58,
        "sar_vh_change": 0.64,
        "roadStatus": "blocked",
    },
    {
        "id": "z2_cherra_hill",
        "name": "Cherrapunji Escarpment",
        "district": "East Khasi Hills, Meghalaya",
        "lat": 25.2989,
        "lng": 91.5822,
        "elevation_m": 1380.0,
        "slope_deg": 31.0,
        "aspect_deg": 190.0,
        "ndvi": 0.51,
        "sar_disturbance": 0.70,
        "sar_vv_change": 0.48,
        "sar_vh_change": 0.53,
        "roadStatus": "restricted",
    },
    {
        "id": "z3_ukhrul_slope",
        "name": "Ukhrul Heights",
        "district": "Ukhrul, Manipur",
        "lat": 25.0489,
        "lng": 94.3617,
        "elevation_m": 1660.0,
        "slope_deg": 26.0,
        "aspect_deg": 120.0,
        "ndvi": 0.62,
        "sar_disturbance": 0.38,
        "sar_vv_change": 0.28,
        "sar_vh_change": 0.32,
        "roadStatus": "restricted",
    },
    {
        "id": "z4_aizawl_east",
        "name": "Aizawl Ridge",
        "district": "Aizawl, Mizoram",
        "lat": 23.7307,
        "lng": 92.7176,
        "elevation_m": 1132.0,
        "slope_deg": 29.5,
        "aspect_deg": 270.0,
        "ndvi": 0.58,
        "sar_disturbance": 0.54,
        "sar_vv_change": 0.36,
        "sar_vh_change": 0.44,
        "roadStatus": "open",
    },
    {
        "id": "z5_kohima_north",
        "name": "Kohima Crest",
        "district": "Kohima, Nagaland",
        "lat": 25.6747,
        "lng": 94.1086,
        "elevation_m": 1444.0,
        "slope_deg": 23.0,
        "aspect_deg": 95.0,
        "ndvi": 0.65,
        "sar_disturbance": 0.30,
        "sar_vv_change": 0.22,
        "sar_vh_change": 0.25,
        "roadStatus": "open",
    },
]


class RiskEngine:
    def __init__(self):
        self.agent_a_model = None
        self.agent_a_features = []
        self.agent_b_model = None
        self.agent_b_features = []
        self.is_loaded = False
        self._load_models()

    def _load_models(self):
        try:
            if os.path.exists(AGENT_A_MODEL_PATH):
                with open(AGENT_A_MODEL_PATH, "rb") as f:
                    bundle_a = pickle.load(f)
                    self.agent_a_model = bundle_a["model"]
                    self.agent_a_features = bundle_a["features"]
                    print(f"[RiskEngine] Loaded Agent A ({len(self.agent_a_features)} features)")

            if os.path.exists(AGENT_B_MODEL_PATH):
                with open(AGENT_B_MODEL_PATH, "rb") as f:
                    bundle_b = pickle.load(f)
                    self.agent_b_model = bundle_b["model"]
                    self.agent_b_features = bundle_b["features"]
                    print(f"[RiskEngine] Loaded Agent B ({len(self.agent_b_features)} features)")

            self.is_loaded = (self.agent_a_model is not None and self.agent_b_model is not None)
        except Exception as e:
            print(f"[RiskEngine] Warning loading models: {e}")
            self.is_loaded = False

    def get_risk_level(self, score: int) -> str:
        if score >= 75:
            return "critical"
        if score >= 55:
            return "high"
        if score >= 30:
            return "moderate"
        return "low"

    def predict_spatial_susceptibility(self, spatial_dict: Dict[str, float]) -> float:
        """
        Evaluate Agent A on spatial geomorphology.
        Features: elevation_m, slope_deg, aspect_sin, aspect_cos, ndvi, sar_disturbance, sar_vv_change, sar_vh_change
        """
        aspect_rad = math.radians(spatial_dict.get("aspect_deg", 0.0))
        features_dict = {
            "elevation_m": spatial_dict.get("elevation_m", 800.0),
            "slope_deg": spatial_dict.get("slope_deg", 20.0),
            "aspect_sin": math.sin(aspect_rad),
            "aspect_cos": math.cos(aspect_rad),
            "ndvi": spatial_dict.get("ndvi", 0.5),
            "sar_disturbance": spatial_dict.get("sar_disturbance", 0.3),
            "sar_vv_change": spatial_dict.get("sar_vv_change", 0.2),
            "sar_vh_change": spatial_dict.get("sar_vh_change", 0.2),
        }

        if self.agent_a_model is not None:
            df = pd.DataFrame([features_dict])[self.agent_a_features]
            prob = float(self.agent_a_model.predict_proba(df)[0, 1])
            return prob

        # Heuristic fallback if model not loaded
        slope_norm = min(1.0, spatial_dict.get("slope_deg", 20.0) / 45.0)
        sar_norm = min(1.0, spatial_dict.get("sar_disturbance", 0.3) / 1.5)
        veg_norm = 1.0 - max(0.0, min(1.0, spatial_dict.get("ndvi", 0.5)))
        return float(0.50 * slope_norm + 0.30 * sar_norm + 0.20 * veg_norm)

    def predict_dynamic_trigger(self, susceptibility_score: float, rain_features: Dict[str, float]) -> float:
        """
        Evaluate Agent B on Agent A susceptibility score + dynamic weather windows.
        Features: susceptibility_score, rain_1d, rain_3d_sum, rain_7d_sum, rain_14d_sum, rain_30d_sum, rain_max_7d, api_7d
        """
        features_dict = {
            "susceptibility_score": susceptibility_score,
            "rain_1d": rain_features.get("rain_1d", 0.0),
            "rain_3d_sum": rain_features.get("rain_3d_sum", 0.0),
            "rain_7d_sum": rain_features.get("rain_7d_sum", 0.0),
            "rain_14d_sum": rain_features.get("rain_14d_sum", 0.0),
            "rain_30d_sum": rain_features.get("rain_30d_sum", 0.0),
            "rain_max_7d": rain_features.get("rain_max_7d", 0.0),
            "api_7d": rain_features.get("api_7d", 0.0),
        }

        if self.agent_b_model is not None:
            df = pd.DataFrame([features_dict])[self.agent_b_features]
            prob = float(self.agent_b_model.predict_proba(df)[0, 1])
            return prob

        # Heuristic fallback
        rain_load = min(1.0, (rain_features.get("rain_1d", 0.0) * 0.7 + rain_features.get("rain_7d_sum", 0.0) * 0.05) / 100.0)
        return float(min(0.99, 0.45 * susceptibility_score + 0.55 * rain_load))

    def evaluate_zone(self, zone_spec: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates full dual-agent risk for a registered or arbitrary monitoring zone.
        """
        lat = zone_spec["lat"]
        lng = zone_spec["lng"]

        # 1. Fetch live rainfall features
        rain_features = compute_rainfall_features(lat, lng)
        rainfall_24h = rain_features["rain_1d"]
        rainfall_7d = rain_features["rain_7d_sum"]

        # 2. Run Agent A (Spatial Susceptibility)
        susceptibility_score = self.predict_spatial_susceptibility(zone_spec)

        # 3. Run Agent B (Dynamic Trigger Probability)
        trigger_prob = self.predict_dynamic_trigger(susceptibility_score, rain_features)

        # 4. Calibrate final Risk Score (0-100) combining geomorphic vulnerability, trigger likelihood, and road status
        road_status = zone_spec.get("roadStatus", "open")
        road_penalty = 8 if road_status == "blocked" else 4 if road_status == "restricted" else 0

        # Weighted composite score: 40% Agent A susceptibility, 50% Agent B dynamic trigger, 10% road vulnerability
        raw_score = (susceptibility_score * 40.0) + (trigger_prob * 50.0) + road_penalty
        score = int(max(1, min(99, round(raw_score))))
        level = self.get_risk_level(score)

        # 5. Explainability factors & narrative
        factors = compute_factor_breakdown(
            slope_deg=zone_spec.get("slope_deg", 20.0),
            rainfall_24h=rainfall_24h,
            rainfall_7d=rainfall_7d,
            sar_disturbance=zone_spec.get("sar_disturbance", 0.3),
            ndvi=zone_spec.get("ndvi", 0.5),
            susceptibility_score=susceptibility_score,
            trigger_prob=trigger_prob,
        )

        explanation = generate_narrative_explanation(
            zone_name=zone_spec.get("name", "Target Site"),
            district=zone_spec.get("district", "Region"),
            risk_level=level,
            risk_score=score,
            susceptibility_score=susceptibility_score,
            trigger_prob=trigger_prob,
            rainfall_24h=rainfall_24h,
            slope_deg=zone_spec.get("slope_deg", 20.0),
            road_status=road_status,
        )

        return {
            "id": zone_spec["id"],
            "name": zone_spec["name"],
            "district": zone_spec["district"],
            "lat": lat,
            "lng": lng,
            "riskScore": score,
            "riskLevel": level,
            "susceptibilityScore": round(susceptibility_score, 3),
            "triggerProbability": round(trigger_prob, 3),
            "rainfall24h": rainfall_24h,
            "rainfall7d": rainfall_7d,
            "roadStatus": road_status,
            "factors": factors,
            "explanation": explanation,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

    def get_all_zones(self) -> List[Dict[str, Any]]:
        return [self.evaluate_zone(z) for z in REGISTERED_ZONES]

    def get_zone_by_id(self, zone_id: str) -> Optional[Dict[str, Any]]:
        zone = next((z for z in REGISTERED_ZONES if z["id"] == zone_id), None)
        if not zone:
            return None
        return self.evaluate_zone(zone)


_engine_instance: Optional[RiskEngine] = None

def get_risk_engine() -> RiskEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RiskEngine()
    return _engine_instance
