"""
fetch_ground_disturbance.py

Computes a ground-disturbance signal from Sentinel-1 SAR backscatter change
detection (before vs. after) for each target zone, and exports the result
as GeoTIFFs into ml/data/raw/sentinel1_deformation/.

Mirrors the structure of fetch_ndvi.py / fetch_terrain.py in this pipeline:
- Same Earth Engine auth/init pattern
- Same per-zone loop + export-to-local-GeoTIFF pattern
- Output naming: <zone_id>_disturbance.<band>.tif (one file per band -
  keeps each individual download well under Earth Engine's ~48MB direct
  download cap, which a combined 3-band file at fine resolution exceeded)

Method:
- Pull Sentinel-1 GRD (VV + VH, IW mode, ascending or descending — configurable)
  for a "before" window and an "after" window.
- Speckle-filter with a focal median, then take the log-ratio
  (after / before) in dB for each polarization.
- Combine VV + VH log-ratio into a single disturbance magnitude band
  (mean of absolute log-ratios), since abrupt land-surface change
  (hill-cutting, slope failure precursors, construction, deforestation)
  shows up as a spike in backscatter change regardless of polarization.
- Clip to zone geometry and export.

Requires: earthengine-api, geemap (for local export helper)
    pip install earthengine-api geemap
Auth (one-time): earthengine authenticate
"""

import os
import sys
import argparse
from datetime import datetime

import ee
import geemap

try:
    from zones_config import ZONE_BOUNDS
except ImportError:
    from ml.scripts.zones_config import ZONE_BOUNDS


def build_zones():
    """Construct ee.Geometry objects. Must be called AFTER ee.Initialize()."""
    return {zid: ee.Geometry.Rectangle(bounds) for zid, bounds in ZONE_BOUNDS.items()}


OUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "data", "raw", "sentinel1_deformation"
)


def get_s1_collection(geometry, start, end, orbit="ASCENDING"):
    """Filtered, speckle-reduced Sentinel-1 GRD collection for a window."""
    coll = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(geometry)
        .filterDate(start, end)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", orbit))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .select(["VV", "VH"])
    )
    return coll


def speckle_filter(image, radius=30):
    """Simple focal-median speckle filter."""
    return image.focal_median(radius, "circle", "meters")


def composite_window(geometry, start, end, orbit="ASCENDING"):
    """Median composite (in linear power, converted back to dB) for a window."""
    coll = get_s1_collection(geometry, start, end, orbit)
    n = coll.size().getInfo()
    if n == 0:
        raise ValueError(
            f"No Sentinel-1 scenes found for {start}..{end} "
            f"(orbit={orbit}) over this geometry."
        )
    # Convert dB -> linear power before averaging, then back to dB
    linear = coll.map(lambda img: ee.Image(10).pow(img.divide(10)))
    median_linear = linear.median()
    median_db = median_linear.log10().multiply(10)
    return speckle_filter(median_db).clip(geometry)


def disturbance_image(geometry, before_start, before_end, after_start, after_end, orbit="ASCENDING"):
    """Log-ratio change detection combined across VV + VH into one band."""
    before = composite_window(geometry, before_start, before_end, orbit)
    after = composite_window(geometry, after_start, after_end, orbit)

    log_ratio = after.subtract(before)  # already in dB, so this is the log-ratio
    vv_change = log_ratio.select("VV").abs()
    vh_change = log_ratio.select("VH").abs()

    disturbance = vv_change.add(vh_change).divide(2).rename("disturbance")
    return disturbance.addBands(vv_change.rename("vv_change")).addBands(
        vh_change.rename("vh_change")
    )


def export_zone(zone_id, geometry, before_start, before_end, after_start, after_end, orbit, out_dir, scale):
    print(f"[{zone_id}] Building before/after composites "
          f"({before_start}..{before_end} vs {after_start}..{after_end}, orbit={orbit})")
    img = disturbance_image(geometry, before_start, before_end, after_start, after_end, orbit)

    os.makedirs(out_dir, exist_ok=True)

    # Export each band as its own single-band file. A combined 3-band
    # file at fine resolution exceeds Earth Engine's ~48MB direct
    # download cap for these zone sizes; single bands at this scale
    # stay comfortably under it and geemap's tiled fallback (which
    # kicks in automatically if still needed) then works reliably.
    for band in ("disturbance", "vv_change", "vh_change"):
        out_path = os.path.join(out_dir, f"{zone_id}_{band}.tif")
        print(f"[{zone_id}] Exporting band '{band}' to {out_path} (scale={scale}m)")
        geemap.ee_export_image(
            img.select(band),
            filename=out_path,
            scale=scale,
            region=geometry,
            file_per_band=False,
        )
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            print(f"[{zone_id}]   -> saved {os.path.basename(out_path)} "
                  f"({os.path.getsize(out_path) / 1024:.0f} KB)")
        else:
            print(f"[{zone_id}]   !! export FAILED or produced an empty file for band '{band}'")

    print(f"[{zone_id}] Done.")


def parse_args():
    p = argparse.ArgumentParser(description="Fetch Sentinel-1 ground disturbance layer per zone.")
    p.add_argument("--before-start", required=True, help="e.g. 2024-11-01")
    p.add_argument("--before-end", required=True, help="e.g. 2025-02-28")
    p.add_argument("--after-start", required=True, help="e.g. 2025-11-01")
    p.add_argument("--after-end", required=True, help="e.g. 2026-02-28")
    p.add_argument("--orbit", default="ASCENDING", choices=["ASCENDING", "DESCENDING"])
    p.add_argument(
        "--scale", type=int, default=100,
        help="Export resolution in meters. Increased from the original 20m default - "
             "at 20m, these zone sizes exceed Earth Engine's direct-download cap and "
             "the export silently fails. 100m keeps every zone comfortably under it "
             "while still being far finer than the ~1km grid cells used downstream.",
    )
    p.add_argument("--zones", nargs="*", default=None, help="Subset of zone ids to run (default: all)")
    p.add_argument("--out-dir", default=OUT_DIR)
    p.add_argument("--project", default=None, help="Earth Engine cloud project id, if required by your account")
    return p.parse_args()


def validate_dates(*date_strs):
    for d in date_strs:
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError:
            sys.exit(f"Invalid date format: {d} (expected YYYY-MM-DD)")


def main():
    args = parse_args()
    validate_dates(args.before_start, args.before_end, args.after_start, args.after_end)

    try:
        ee.Initialize(project=args.project) if args.project else ee.Initialize()
    except Exception:
        print("Earth Engine not initialized — running ee.Authenticate() once, then retrying init.")
        ee.Authenticate()
        ee.Initialize(project=args.project) if args.project else ee.Initialize()

    zones = build_zones()  # only build ee.Geometry objects after Initialize()

    zone_ids = args.zones if args.zones else list(zones.keys())
    missing = [z for z in zone_ids if z not in zones]
    if missing:
        sys.exit(f"Unknown zone id(s): {missing}. Available: {list(zones.keys())}")

    for zone_id in zone_ids:
        geometry = zones[zone_id]
        export_zone(
            zone_id,
            geometry,
            args.before_start,
            args.before_end,
            args.after_start,
            args.after_end,
            args.orbit,
            args.out_dir,
            scale=args.scale,
        )

    print("\nAll zones processed. Output written to:", args.out_dir)


if __name__ == "__main__":
    main()