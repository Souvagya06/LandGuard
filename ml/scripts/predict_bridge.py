"""
predict_bridge.py

ML Inference Bridge for LandGuard AI.
Accepts JSON payload via CLI arg or stdin and runs inference using:
- Agent A: Spatial Geomorphology Susceptibility Model (agent_a_susceptibility.pkl)
- Agent B: Dynamic Multi-Hazard Rainfall Trigger Model (agent_b_trigger.pkl)

Usage:
  python ml/scripts/predict_bridge.py '{"elevation_m": 1200, "slope_deg": 28, "ndvi": 0.5, "sar_disturbance": 0.6, "rain_1d": 45, "rain_3d_sum": 90, "rain_7d_sum": 160, "rain_14d_sum": 250, "rain_30d_sum": 400, "rain_max_7d": 50, "api_7d": 35}'
"""

import sys
import os
import json
import math
import pickle
import pandas as pd
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(BASE_DIR, "models")
AGENT_A_PATH = os.path.join(MODEL_DIR, "agent_a_susceptibility.pkl")
AGENT_B_PATH = os.path.join(MODEL_DIR, "agent_b_trigger.pkl")


def load_models():
    agent_a_bundle = None
    agent_b_bundle = None

    if os.path.exists(AGENT_A_PATH):
        with open(AGENT_A_PATH, "rb") as f:
            agent_a_bundle = pickle.load(f)

    if os.path.exists(AGENT_B_PATH):
        with open(AGENT_B_PATH, "rb") as f:
            agent_b_bundle = pickle.load(f)

    return agent_a_bundle, agent_b_bundle


def predict(input_data: dict, agent_a_bundle, agent_b_bundle) -> dict:
    aspect_deg = float(input_data.get("aspect_deg", 180.0))
    aspect_rad = math.radians(aspect_deg)

    # 1. Agent A Features
    agent_a_features = {
        "elevation_m": float(input_data.get("elevation_m", 1000.0)),
        "slope_deg": float(input_data.get("slope_deg", 25.0)),
        "aspect_sin": float(math.sin(aspect_rad)),
        "aspect_cos": float(math.cos(aspect_rad)),
        "ndvi": float(input_data.get("ndvi", 0.55)),
        "sar_disturbance": float(input_data.get("sar_disturbance", 0.4)),
        "sar_vv_change": float(input_data.get("sar_vv_change", 0.3)),
        "sar_vh_change": float(input_data.get("sar_vh_change", 0.35)),
    }

    if agent_a_bundle:
        model_a = agent_a_bundle["model"]
        cols_a = agent_a_bundle["features"]
        df_a = pd.DataFrame([agent_a_features])[cols_a]
        susceptibility_score = float(model_a.predict_proba(df_a)[0, 1])
    else:
        # Fallback formula matching training definition
        slope_norm = min(1.0, agent_a_features["slope_deg"] / 45.0)
        sar_norm = min(1.0, agent_a_features["sar_disturbance"] / 1.5)
        veg_norm = 1.0 - max(0.0, min(1.0, agent_a_features["ndvi"]))
        susceptibility_score = 0.50 * slope_norm + 0.30 * sar_norm + 0.20 * veg_norm

    # 2. Agent B Features
    agent_b_features = {
        "susceptibility_score": float(susceptibility_score),
        "rain_1d": float(input_data.get("rain_1d", 0.0)),
        "rain_3d_sum": float(input_data.get("rain_3d_sum", 0.0)),
        "rain_7d_sum": float(input_data.get("rain_7d_sum", 0.0)),
        "rain_14d_sum": float(input_data.get("rain_14d_sum", 0.0)),
        "rain_30d_sum": float(input_data.get("rain_30d_sum", 0.0)),
        "rain_max_7d": float(input_data.get("rain_max_7d", 0.0)),
        "api_7d": float(input_data.get("api_7d", 0.0)),
    }

    if agent_b_bundle:
        model_b = agent_b_bundle["model"]
        cols_b = agent_b_bundle["features"]
        df_b = pd.DataFrame([agent_b_features])[cols_b]
        trigger_probability = float(model_b.predict_proba(df_b)[0, 1])
    else:
        rain_load = min(1.0, (agent_b_features["rain_1d"] * 0.7 + agent_b_features["rain_7d_sum"] * 0.05) / 100.0)
        trigger_probability = min(0.99, 0.45 * susceptibility_score + 0.55 * rain_load)

    # Composite calibrated risk score (0 - 100)
    road_status = input_data.get("roadStatus", "open")
    road_penalty = 8 if road_status == "blocked" else 4 if road_status == "restricted" else 0
    raw_risk = (susceptibility_score * 40.0) + (trigger_probability * 50.0) + road_penalty
    risk_score = int(max(1, min(99, round(raw_risk))))

    if risk_score >= 75:
        risk_level = "critical"
    elif risk_score >= 55:
        risk_level = "high"
    elif risk_score >= 30:
        risk_level = "moderate"
    else:
        risk_level = "low"

    return {
        "susceptibility_score": round(susceptibility_score, 4),
        "trigger_probability": round(trigger_probability, 4),
        "risk_score": risk_score,
        "risk_level": risk_level,
    }


def main():
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
    else:
        raw_input = sys.stdin.read()

    try:
        data = json.loads(raw_input)
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON payload: {e}"}))
        sys.exit(1)

    agent_a_bundle, agent_b_bundle = load_models()

    if isinstance(data, list):
        results = [predict(item, agent_a_bundle, agent_b_bundle) for item in data]
        print(json.dumps(results))
    else:
        res = predict(data, agent_a_bundle, agent_b_bundle)
        print(json.dumps(res))


if __name__ == "__main__":
    main()
