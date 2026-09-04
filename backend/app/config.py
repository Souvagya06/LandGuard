"""
Configuration settings for LandGuard AI backend.
"""

import os
from pathlib import Path

# Base project paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_DIR = BASE_DIR / "ml"
ML_MODELS_DIR = ML_DIR / "models"
ML_DATA_DIR = ML_DIR / "data"
ML_PROCESSED_DIR = ML_DATA_DIR / "processed"
ML_RAW_DIR = ML_DATA_DIR / "raw"

# Model paths
AGENT_A_MODEL_PATH = str(ML_MODELS_DIR / "agent_a_susceptibility.pkl")
AGENT_B_MODEL_PATH = str(ML_MODELS_DIR / "agent_b_trigger.pkl")
FEATURE_TABLE_PATH = str(ML_PROCESSED_DIR / "feature_table.csv")

# Weather service
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
WEATHER_CACHE_TTL_SECONDS = 300  # 5 minutes cache

# Risk score thresholds
RISK_THRESHOLDS = {
    "low": 0,
    "moderate": 30,
    "high": 55,
    "critical": 75,
}

# CORS settings
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]
