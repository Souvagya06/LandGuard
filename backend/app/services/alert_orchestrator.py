"""
Alert Orchestrator service for LandGuard AI.
Manages alert creation, auto-dispatch triggers, and in-memory persistence.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import math

_alerts: List[Dict[str, Any]] = [
    {
        "id": "a-1725450000001",
        "zoneId": "west_siang_arunachal_pradesh",
        "zoneName": "Aalo Highway Sector",
        "level": "critical",
        "message": "Critical landslide hazard on Aalo Highway. Slopes saturated by monsoon rainfall. Road blocked.",
        "channel": "sms",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    },
    {
        "id": "a-1725450000002",
        "zoneId": "papum_pare_arunachal_pradesh",
        "zoneName": "Itanagar Hills",
        "level": "high",
        "message": "High landslide warning for Itanagar Hills. Debris flow watch in effect for NH-415 cut slopes.",
        "channel": "dashboard",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    },
]


def list_alerts() -> List[Dict[str, Any]]:
    return _alerts


def create_alert(zone_data: Dict[str, Any], channel: str = "dashboard") -> Dict[str, Any]:
    alert_id = f"a-{math.floor(datetime.now().timestamp() * 1000)}"
    risk_level = zone_data.get("riskLevel", "moderate")
    zone_name = zone_data.get("name", "Monitored Zone")
    
    message = (
        f"{risk_level.title()} Landslide Advisory for {zone_name}. "
        f"Composite Risk: {zone_data.get('riskScore', 50)}%. Take immediate safety precautions."
    )

    alert = {
        "id": alert_id,
        "zoneId": zone_data["id"],
        "zoneName": zone_name,
        "level": risk_level,
        "message": message,
        "channel": channel,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _alerts.insert(0, alert)
    return alert
