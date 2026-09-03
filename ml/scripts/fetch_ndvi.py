"""
fetch_ndvi.py

Pulls Sentinel-2 imagery via Google Earth Engine for each Arunachal
Pradesh AOI, cloud-masks it, computes NDVI, and exports a cloud-free
median-composite NDVI raster per AOI - matching the same three zones
used for the DEM/slope/aspect rasters.

One-time setup (run once, opens a browser to sign in):
    earthengine authenticate

Install dependencies:
    pip install earthengine-api geemap

Usage:
    python fetch_ndvi.py
"""

import os

import ee
import geemap

# --- EDIT ME ---------------------------------------------------------
# Must match a Google Cloud project linked to your Earth Engine account
# (created automatically during Earth Engine sign-up if you don't have
# one already - check console.cloud.google.com or the EE registration
# page for the exact project ID).
EE_PROJECT_ID = "serene-voltage-489103-s0"

# A cloud-free pre-monsoon window gives the cleanest NDVI baseline for
# Arunachal Pradesh. Widen this range if a zone comes back too cloudy.
START_DATE = "2025-11-01"
END_DATE = "2026-02-28"

# Bounding boxes: (min_lon, min_lat, max_lon, max_lat)
# West Siang box matches exactly what was drawn on OpenTopography.
# The other two are placeholders from our earlier planning discussion -
# EDIT these to match whatever box you actually drew for those two DEMs
# if it was different, so the NDVI raster lines up with your DEM extent.
AOIS = {
    "west_siang_arunachal_pradesh": (93.6955, 27.6381, 95.0551, 29.0282),
    "lower_subansiri_arunachal_pradesh": (93.75, 27.45, 93.95, 27.65),
    "papum_pare_arunachal_pradesh": (93.55, 27.00, 93.70, 27.15),
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "sentinel2_ndvi")
# -----------------------------------------------------------------------


def mask_s2_clouds(image: ee.Image) -> ee.Image:
    """Cloud-mask a Sentinel-2 SR image using the QA60 band (bits 10 and
    11 flag clouds and cirrus)."""
    qa = image.select("QA60")
    cloud_bit = 1 << 10
    cirrus_bit = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit).eq(0).And(qa.bitwiseAnd(cirrus_bit).eq(0))
    return image.updateMask(mask).divide(10000)


def build_ndvi_composite(region: ee.Geometry) -> ee.Image:
    """Median-composite, cloud-masked NDVI over the date range for one AOI."""
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(START_DATE, END_DATE)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 40))
        .map(mask_s2_clouds)
    )

    composite = collection.median()
    ndvi = composite.normalizedDifference(["B8", "B4"]).rename("NDVI")
    return ndvi.clip(region)


def main() -> None:
    ee.Initialize(project=EE_PROJECT_ID)
    os.makedirs(OUT_DIR, exist_ok=True)

    for name, (min_lon, min_lat, max_lon, max_lat) in AOIS.items():
        print(f"Processing {name} ...")
        region = ee.Geometry.Rectangle([min_lon, min_lat, max_lon, max_lat])
        ndvi = build_ndvi_composite(region)

        out_path = os.path.join(OUT_DIR, f"{name}_ndvi.tif")
        geemap.ee_export_image(
            ndvi,
            filename=out_path,
            scale=10,
            region=region,
            file_per_band=False,
        )
        print(f"  -> saved {os.path.basename(out_path)}")

    print("\nDone. NDVI rasters saved to", OUT_DIR)


if __name__ == "__main__":
    main()