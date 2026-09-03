"""
zones_config.py

Single source of truth for LandGuard's monitoring-zone boundaries.

No coordinates are hardcoded anywhere in this file. Each zone's bounding
box is derived directly from the DEM GeoTIFF you already downloaded from
OpenTopography (ml/data/raw/srtm_dem/<zone_id>_dem.tif) - that file's own
georeferencing metadata IS the bounding box. Every other script (NDVI,
ground disturbance, landslide catalog, rainfall history) imports from
here, so they all automatically stay aligned with whatever area you
actually selected on OpenTopography - nothing to keep in sync by hand,
and adding a fourth zone later just means dropping in one more DEM file.

Zone IDs are derived from filenames: <zone_id>_dem.tif -> zone_id

Requires: rasterio
    pip install rasterio
"""

import glob
import os

import rasterio

SRTM_DEM_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "srtm_dem")

_cache = None


def get_zone_bounds_from_dem(dem_dir: str = SRTM_DEM_DIR) -> dict:
    """Scan dem_dir for *_dem.tif files and return
    {zone_id: (min_lon, min_lat, max_lon, max_lat)} read straight from
    each file's own georeferencing - never hardcoded.
    """
    global _cache
    if _cache is not None:
        return _cache

    bounds_by_zone = {}
    dem_files = sorted(glob.glob(os.path.join(dem_dir, "*_dem.tif")))

    if not dem_files:
        raise FileNotFoundError(
            f"No DEM files found in {dem_dir}. Download DEMs from "
            "OpenTopography first - every zone boundary in this pipeline "
            "is derived from those files, so nothing else can run before "
            "this step."
        )

    for dem_path in dem_files:
        filename = os.path.basename(dem_path)
        zone_id = filename[: -len("_dem.tif")]
        with rasterio.open(dem_path) as src:
            left, bottom, right, top = src.bounds
        bounds_by_zone[zone_id] = (left, bottom, right, top)
        print(f"  {zone_id}: [{left:.4f}, {bottom:.4f}, {right:.4f}, {top:.4f}]")

    _cache = bounds_by_zone
    return bounds_by_zone


def __getattr__(name):
    # Lets `from zones_config import ZONE_BOUNDS` work as a plain-dict
    # import for scripts that prefer that style, computed lazily so
    # just importing this module doesn't fail if DEMs aren't downloaded
    # yet (e.g. when someone is just browsing the code).
    if name == "ZONE_BOUNDS":
        return get_zone_bounds_from_dem()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


if __name__ == "__main__":
    print("Zone bounds derived from ml/data/raw/srtm_dem/*_dem.tif:\n")
    get_zone_bounds_from_dem()