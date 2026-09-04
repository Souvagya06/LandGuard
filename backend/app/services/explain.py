"""
Explainability and Natural Language Advisory Generator for LandGuard AI.
Translates ML feature values, Agent A susceptibility, and Agent B trigger probability
into human-understandable factor contributions and actionable emergency directives.
"""

from typing import List, Dict, Any


def compute_factor_breakdown(
    slope_deg: float,
    rainfall_24h: float,
    rainfall_7d: float,
    sar_disturbance: float,
    ndvi: float,
    susceptibility_score: float,
    trigger_prob: float,
) -> List[Dict[str, Any]]:
    """
    Computes normalized factor breakdown for visualization (e.g. 0-100 scale).
    """
    # 1. Rainfall load factor
    rain_factor = min(100, int(rainfall_24h * 1.2 + rainfall_7d * 0.15))

    # 2. Slope angle factor
    slope_factor = min(100, int((slope_deg / 45.0) * 85))

    # 3. Ground / SAR disturbance factor
    sar_factor = min(100, int((sar_disturbance / 1.2) * 80))

    # 4. Vegetation / Canopy loss factor (low ndvi means high vegetation loss)
    veg_loss_factor = min(100, int((1.0 - max(0.0, min(1.0, ndvi))) * 70))

    return [
        {"label": "Rainfall (24h + 7d)", "value": rain_factor},
        {"label": "Slope angle", "value": slope_factor},
        {"label": "Soil / SAR disturbance", "value": max(5, sar_factor)},
        {"label": "Vegetation loss", "value": max(5, veg_loss_factor)},
    ]


def generate_narrative_explanation(
    zone_name: str,
    district: str,
    risk_level: str,
    risk_score: int,
    susceptibility_score: float,
    trigger_prob: float,
    rainfall_24h: float,
    slope_deg: float,
    road_status: str,
) -> str:
    """
    Produces a clear, professional summary statement for field operations.
    """
    susc_pct = int(susceptibility_score * 100)
    trig_pct = int(trigger_prob * 100)

    if risk_level == "critical":
        return (
            f"CRITICAL HAZARD: {zone_name} ({district}) exhibits extreme landslide probability ({risk_score}%). "
            f"Steep geomorphology (slope {slope_deg:.1f}°, {susc_pct}% baseline susceptibility) saturated by {rainfall_24h:.1f}mm "
            f"rainfall in 24h triggers a {trig_pct}% slope failure event probability. Roadway is currently {road_status}. "
            "Immediate slope monitoring and vehicular diversion recommended."
        )
    elif risk_level == "high":
        return (
            f"HIGH WARNING: {zone_name} has elevated instability risk ({risk_score}%). "
            f"Precipitation of {rainfall_24h:.1f}mm on a {slope_deg:.1f}° gradient elevates dynamic trigger likelihood to {trig_pct}%. "
            "Field officers should inspect vulnerable culverts and roadside cuts."
        )
    elif risk_level == "moderate":
        return (
            f"MODERATE ADVISORY: {zone_name} presents localized slope vulnerability ({risk_score}%). "
            f"Baseline terrain susceptibility is {susc_pct}%. Rainfall remains within monitored thresholds ({rainfall_24h:.1f}mm)."
        )
    else:
        return (
            f"STABLE CONDITIONS: {zone_name} exhibits low landslide risk ({risk_score}%). "
            f"Vegetation cover is resilient and rainfall load ({rainfall_24h:.1f}mm) is low."
        )
