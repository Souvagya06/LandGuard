"""Download and composite Sentinel-2 L2A NDVI without Google Earth Engine.

The script searches Microsoft Planetary Computer's public STAC catalogue,
selects the least-cloudy Sentinel-2 scenes, and creates a locally computed,
cloud-masked median NDVI GeoTIFF for every LandGuard monitoring zone.

The area of interest is always read from ``zones_config`` (or the DEM
metadata it exposes). That keeps the imagery, terrain layers, and
historic-landslide labels spatially consistent - nothing hardcoded.

Install:
    pip install numpy rasterio pystac-client planetary-computer certifi

Example:
    python fetch_ndvi.py --start-date 2025-11-01 --end-date 2026-02-28
"""

import argparse
import os
import sys
import time
import warnings

import certifi
import numpy as np
import planetary_computer
import rasterio
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.errors import RasterioError
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT

try:
    from zones_config import get_zone_bounds_from_dem
except ImportError:
    from ml.scripts.zones_config import get_zone_bounds_from_dem


# --- Windows SSL fix -------------------------------------------------------
# GDAL/curl on many Windows Python installs can't locate a valid root CA
# bundle, which makes every single remote-tile read fail identically
# ("unable to read a remote tile ... Read failed") even though the network
# connection itself is fine. Pointing curl explicitly at certifi's bundle
# fixes this without touching system certificate stores.
os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
# -----------------------------------------------------------------------


STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "sentinel2_ndvi")
NODATA = -9999.0
CLEAR_SCL_CLASSES = {4, 5, 6, 7}  # vegetation, bare soil, water, unclassified
MAX_READ_ATTEMPTS = 5


def parse_args():
    parser = argparse.ArgumentParser(description="Create cloud-masked Sentinel-2 NDVI rasters via STAC.")
    parser.add_argument("--start-date", default="2025-11-01", help="Inclusive date, YYYY-MM-DD")
    parser.add_argument("--end-date", default="2026-02-28", help="Inclusive date, YYYY-MM-DD")
    parser.add_argument("--max-cloud-cover", type=float, default=40, help="Scene cloud-cover threshold (0-100)")
    parser.add_argument("--max-items", type=int, default=12, help="Maximum least-cloudy scenes to composite")
    parser.add_argument(
        "--resolution-degrees",
        type=float,
        default=0.0001,
        help="Output grid resolution in EPSG:4326 degrees (0.0001 is about 10 m)",
    )
    parser.add_argument("--zones", nargs="*", default=None, help="Optional list of zone IDs")
    parser.add_argument("--out-dir", default=OUT_DIR, help="Directory for output GeoTIFFs")
    return parser.parse_args()


def find_scenes(catalog, bounds, start_date, end_date, max_cloud_cover, max_items):
    """Return signed B04/B08/SCL scenes, ordered from least to most cloudy."""
    search = catalog.search(
        collections=[COLLECTION],
        bbox=bounds,
        datetime=f"{start_date}/{end_date}",
        query={"eo:cloud_cover": {"lt": max_cloud_cover}},
    )
    scenes = []
    for item in search.item_collection():
        if {"B04", "B08", "SCL"}.issubset(item.assets):
            scenes.append(planetary_computer.sign(item))

    scenes.sort(key=lambda item: item.properties.get("eo:cloud_cover", 100))
    return scenes[:max_items]


def output_profile(bounds, resolution):
    min_lon, min_lat, max_lon, max_lat = bounds
    width = int(np.ceil((max_lon - min_lon) / resolution))
    height = int(np.ceil((max_lat - min_lat) / resolution))
    transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)
    return {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,
        "dtype": "float32",
        "crs": "EPSG:4326",
        "transform": transform,
        "nodata": NODATA,
        "compress": "deflate",
        "tiled": True,
        "blockxsize": 512,
        "blockysize": 512,
    }


def read_window(asset_href, profile, window, resampling):
    """Read one remote COG asset, retrying transient HTTP/range-read failures."""
    for attempt in range(1, MAX_READ_ATTEMPTS + 1):
        try:
            # Single-range requests are more reliable than GDAL's multi-range
            # requests against occasionally busy public object storage.
            # Explicit CA bundle (see top of file) fixes Windows SSL failures;
            # longer timeout/more retries here handle genuinely slow links.
            with rasterio.Env(
                CURL_CA_BUNDLE=certifi.where(),
                GDAL_HTTP_MULTIRANGE="NO",
                GDAL_HTTP_TIMEOUT="120",
                GDAL_HTTP_CONNECTTIMEOUT="30",
                GDAL_HTTP_MAX_RETRY="5",
                GDAL_HTTP_RETRY_DELAY="2",
                GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            ):
                with rasterio.open(asset_href) as source:
                    with WarpedVRT(
                        source,
                        crs=profile["crs"],
                        transform=profile["transform"],
                        width=profile["width"],
                        height=profile["height"],
                        resampling=resampling,
                        nodata=np.nan,
                    ) as warped:
                        return warped.read(1, window=window, masked=True).filled(np.nan).astype("float32")
        except RasterioError as error:
            if attempt == MAX_READ_ATTEMPTS:
                print(f"  unable to read a remote tile after {MAX_READ_ATTEMPTS} attempts: {error}")
                return None
            time.sleep(attempt * 2)


def write_ndvi(zone_id, bounds, scenes, out_path, resolution):
    """Stream a median NDVI composite to disk, avoiding a full-raster memory load."""
    profile = output_profile(bounds, resolution)
    unusable_assets = set()
    with rasterio.open(out_path, "w", **profile) as output:
        for _, window in output.block_windows(1):
            ndvi_layers = []
            for scene in scenes:
                asset_hrefs = [scene.assets[key].href for key in ("SCL", "B04", "B08")]
                if any(href in unusable_assets for href in asset_hrefs):
                    continue

                scl = read_window(asset_hrefs[0], profile, window, Resampling.nearest)
                red = read_window(asset_hrefs[1], profile, window, Resampling.bilinear)
                nir = read_window(asset_hrefs[2], profile, window, Resampling.bilinear)
                if scl is None or red is None or nir is None:
                    unusable_assets.update(asset_hrefs)
                    continue

                valid = np.isin(scl, tuple(CLEAR_SCL_CLASSES)) & np.isfinite(red) & np.isfinite(nir)
                denominator = nir + red
                ndvi = np.where(valid & (denominator != 0), (nir - red) / denominator, np.nan)
                ndvi_layers.append(ndvi)

            if ndvi_layers:
                with warnings.catch_warnings():
                    # Blocks outside every selected scene, or fully cloud-masked
                    # blocks, are intentionally written as NoData below.
                    warnings.filterwarnings("ignore", message="All-NaN slice encountered", category=RuntimeWarning)
                    composite = np.nanmedian(np.stack(ndvi_layers), axis=0)
            else:
                composite = np.full((int(window.height), int(window.width)), np.nan, dtype="float32")
            output.write(np.nan_to_num(composite, nan=NODATA).astype("float32"), 1, window=window)

    print(f"[{zone_id}] wrote {out_path}")


def main():
    args = parse_args()
    if not 0 <= args.max_cloud_cover <= 100:
        sys.exit("--max-cloud-cover must be between 0 and 100")
    if args.max_items < 1 or args.resolution_degrees <= 0:
        sys.exit("--max-items and --resolution-degrees must be positive")

    zone_bounds = get_zone_bounds_from_dem()
    selected_zones = args.zones or list(zone_bounds)
    unknown_zones = sorted(set(selected_zones) - set(zone_bounds))
    if unknown_zones:
        sys.exit(f"Unknown zone ID(s): {', '.join(unknown_zones)}. Available: {', '.join(zone_bounds)}")

    os.makedirs(args.out_dir, exist_ok=True)
    catalog = Client.open(STAC_URL)
    for zone_id in selected_zones:
        bounds = zone_bounds[zone_id]
        print(f"[{zone_id}] searching {bounds} from {args.start_date} to {args.end_date}")
        scenes = find_scenes(catalog, bounds, args.start_date, args.end_date, args.max_cloud_cover, args.max_items)
        if not scenes:
            print(f"[{zone_id}] no suitable Sentinel-2 L2A scenes found; skipping")
            continue
        print(f"[{zone_id}] compositing {len(scenes)} scene(s)")
        write_ndvi(
            zone_id,
            bounds,
            scenes,
            os.path.join(args.out_dir, f"{zone_id}_ndvi.tif"),
            args.resolution_degrees,
        )


if __name__ == "__main__":
    main()