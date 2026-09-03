"""
fetch_terrain.py

Computes slope (degrees) and aspect (compass degrees) rasters from every
DEM GeoTIFF in ml/data/raw/srtm_dem/, using numpy + rasterio only (no
richdem - richdem needs a C++ build toolchain and commonly fails to
install on Windows due to numpy/pybind11 version mismatches at compile
time, as in the error you hit).

Uses Horn's method (the standard 3x3 neighborhood gradient method used
by most GIS tools, including richdem/QGIS) implemented directly with
numpy gradients - same math, zero build dependencies.

Expected input file naming:  <area>_dem.tif
    e.g. west_siang_arunachal_pradesh_dem.tif

Produces, alongside each input:
    <area>_slope.tif    - slope in degrees (0-90)
    <area>_aspect.tif   - aspect in compass degrees (0-360, -1 = flat)

Usage:
    python fetch_terrain.py

Install dependencies first:
    pip install rasterio numpy
"""

import glob
import os

import numpy as np
import rasterio

RAW_DEM_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "srtm_dem")


def compute_slope_aspect(dem_path: str) -> None:
    """Compute slope and aspect rasters for a single DEM file and save
    them alongside it, reusing the DEM's georeferencing metadata."""
    if not dem_path.endswith("_dem.tif"):
        return

    base = dem_path[: -len("_dem.tif")]
    slope_path = f"{base}_slope.tif"
    aspect_path = f"{base}_aspect.tif"

    print(f"Processing {os.path.basename(dem_path)} ...")

    with rasterio.open(dem_path) as src:
        elevation = src.read(1).astype("float64")
        profile = src.profile
        # pixel size in map units (degrees, since these are lat/lon
        # rasters) - fine here, we only need relative slope/aspect
        # for the risk model, not survey-grade accuracy
        x_res = abs(src.transform.a)
        y_res = abs(src.transform.e)
        nodata = src.nodata

    if nodata is not None:
        elevation = np.where(elevation == nodata, np.nan, elevation)

    # Horn's method: gradient in x and y using a 3x3 neighborhood
    dz_dy, dz_dx = np.gradient(elevation, y_res, x_res)

    slope_rad = np.arctan(np.sqrt(dz_dx ** 2 + dz_dy ** 2))
    slope_deg = np.degrees(slope_rad)

    aspect_rad = np.arctan2(dz_dy, -dz_dx)
    aspect_deg = np.degrees(aspect_rad)
    aspect_deg = 90.0 - aspect_deg
    aspect_deg = np.mod(aspect_deg, 360.0)
    # flag flat areas (no slope -> aspect undefined), same convention as richdem/GDAL
    aspect_deg = np.where(slope_deg < 0.01, -1.0, aspect_deg)

    slope_deg = np.nan_to_num(slope_deg, nan=-9999.0).astype("float32")
    aspect_deg = np.nan_to_num(aspect_deg, nan=-9999.0).astype("float32")

    out_profile = profile.copy()
    out_profile.update(dtype="float32", count=1, compress="lzw", nodata=-9999.0)

    with rasterio.open(slope_path, "w", **out_profile) as dst:
        dst.write(slope_deg, 1)
    with rasterio.open(aspect_path, "w", **out_profile) as dst:
        dst.write(aspect_deg, 1)

    print(f"  -> saved {os.path.basename(slope_path)}")
    print(f"  -> saved {os.path.basename(aspect_path)}")


def main() -> None:
    dem_files = sorted(glob.glob(os.path.join(RAW_DEM_DIR, "*_dem.tif")))

    if not dem_files:
        print(f"No DEM files found in {RAW_DEM_DIR}")
        print("Expected files ending in '_dem.tif', e.g. west_siang_arunachal_pradesh_dem.tif")
        return

    print(f"Found {len(dem_files)} DEM file(s).\n")

    for dem_path in dem_files:
        compute_slope_aspect(dem_path)

    print("\nDone. Slope and aspect rasters saved alongside each DEM in srtm_dem/.")


if __name__ == "__main__":
    main()