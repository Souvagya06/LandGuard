"""
zones_config.py

Central configuration for target monitoring zones in Arunachal Pradesh, India.
Used across all data fetching and ML preprocessing scripts to ensure consistent
spatial bounds and zone identifiers.
"""

import glob
import os

# Target zones in Arunachal Pradesh with bounding boxes [min_lon, min_lat, max_lon, max_lat]
# Coordinates correspond to the extent of DEM GeoTIFF rasters in ml/data/raw/srtm_dem/
ZONE_BOUNDS = {
    "west_siang_arunachal_pradesh": [93.6954, 27.6382, 95.0549, 29.0282],
    "lower_subansiri_arunachal_pradesh": [93.5157, 27.2590, 94.2849, 28.0229],
    "papum_pare_arunachal_pradesh": [93.1885, 26.9174, 94.4765, 27.6788],
}


def get_zone_bounds_from_dem(dem_dir=None):
    """
    Attempt to dynamically extract exact bounding boxes from DEM files if rasterio is available.
    Falls back to the pre-configured ZONE_BOUNDS if DEM files or rasterio are not available.
    """
    if dem_dir is None:
        dem_dir = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "srtm_dem")

    if not os.path.exists(dem_dir):
        return ZONE_BOUNDS

    try:
        import rasterio

        bounds_map = {}
        for f in glob.glob(os.path.join(dem_dir, "*_dem.tif")):
            base_name = os.path.basename(f).replace("_dem.tif", "")
            with rasterio.open(f) as src:
                b = src.bounds
                bounds_map[base_name] = [b.left, b.bottom, b.right, b.top]
        if bounds_map:
            return bounds_map
    except ImportError:
        pass

    return ZONE_BOUNDS
