"""Download historic landslide labels without depending on the unstable COOLR API.

The default source is NASA Open Data's downloadable Global Landslide Catalog
CSV. It is a stable catalogue export rather than NASA COOLR's live ArcGIS
service, which can intermittently return HTTP 503. The script filters that
global file to the monitoring-zone bounds derived from the local DEM rasters.

The export is a historical snapshot, so it is appropriate for training labels,
not a real-time landslide feed.

Install:
    pip install pandas requests

Usage:
    python fetch_landslide_catalog.py
    python fetch_landslide_catalog.py --min-date 2007-01-01 --max-date 2025-12-31
"""

import argparse
import io
import os

import pandas as pd
import requests

try:
    from zones_config import get_zone_bounds_from_dem
except ImportError:
    from ml.scripts.zones_config import get_zone_bounds_from_dem


# Official NASA Open Data distribution of the Global Landslide Catalog.
NASA_GLC_CSV_URL = (
    "https://data.nasa.gov/docs/legacy/Global_Landslide_Catalog_Export/"
    "Global_Landslide_Catalog_Export_rows.csv"
)
OUT_PATH_DEFAULT = os.path.join(
    os.path.dirname(__file__), "..", "data", "raw", "nasa_glc_landslides.csv"
)


def download_catalog(source: str) -> pd.DataFrame:
    """Load a local CSV or download the official NASA catalogue export."""
    if os.path.exists(source):
        print(f"Loading local catalog: {source}")
        return pd.read_csv(source, low_memory=False)

    headers = {"User-Agent": "LandGuard-AI/1.0 (academic landslide-risk research)"}
    print(f"Downloading NASA Global Landslide Catalog export ...")
    response = requests.get(source, headers=headers, timeout=120)
    response.raise_for_status()
    return pd.read_csv(io.BytesIO(response.content), low_memory=False)


def clean_dataframe(df: pd.DataFrame, min_date: str | None, max_date: str | None) -> pd.DataFrame:
    """Validate coordinates and apply optional event-date bounds."""
    df = df.copy()
    for column in ("latitude", "longitude"):
        if column not in df.columns:
            raise ValueError(f"Catalog is missing required {column!r} column")
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"])

    if (min_date or max_date) and "event_date" in df.columns:
        dates = pd.to_datetime(df["event_date"], errors="coerce")
        if min_date:
            df = df[dates >= pd.Timestamp(min_date)]
        if max_date:
            df = df[dates <= pd.Timestamp(max_date)]
    return df


def filter_to_zones(df: pd.DataFrame, zone_bounds: dict) -> pd.DataFrame:
    """Assign each record to the first matching configured monitoring zone."""
    assigned = df.copy()
    assigned["zone_id"] = pd.NA
    for zone_id, (min_lon, min_lat, max_lon, max_lat) in zone_bounds.items():
        matches = (
            assigned["zone_id"].isna()
            & assigned["longitude"].between(min_lon, max_lon)
            & assigned["latitude"].between(min_lat, max_lat)
        )
        assigned.loc[matches, "zone_id"] = zone_id
    return assigned[assigned["zone_id"].notna()].reset_index(drop=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Download and filter NASA's Global Landslide Catalog export.")
    parser.add_argument(
        "--source",
        default=NASA_GLC_CSV_URL,
        help="NASA CSV URL or a local full Global Landslide Catalog CSV",
    )
    parser.add_argument("--min-date", default=None, help="Optional lower event-date bound, YYYY-MM-DD")
    parser.add_argument("--max-date", default=None, help="Optional upper event-date bound, YYYY-MM-DD")
    parser.add_argument("--out", default=OUT_PATH_DEFAULT, help="Filtered output CSV path")
    parser.add_argument(
        "--allow-stale-cache",
        action="store_true",
        help="Keep an existing output CSV if the source download is temporarily unavailable",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    zone_bounds = get_zone_bounds_from_dem()
    print("Target zones (derived from downloaded DEM extents):")
    for zone_id, bounds in zone_bounds.items():
        print(f"  {zone_id}: [{bounds[0]:.4f}, {bounds[1]:.4f}, {bounds[2]:.4f}, {bounds[3]:.4f}]")

    try:
        raw_catalog = download_catalog(args.source)
    except requests.RequestException as error:
        out_file = os.path.abspath(args.out)
        if args.allow_stale_cache and os.path.exists(out_file):
            cached_rows = len(pd.read_csv(out_file, low_memory=False))
            print(f"Download failed ({error}). Keeping existing cached catalog ({cached_rows} record(s)): {out_file}")
            return
        raise RuntimeError(
            "Could not download the NASA Global Landslide Catalog export. "
            "Retry later or pass a downloaded CSV with --source."
        ) from error

    cleaned_catalog = clean_dataframe(raw_catalog, args.min_date, args.max_date)
    filtered_catalog = filter_to_zones(cleaned_catalog, zone_bounds)
    print(f"Global valid records: {len(cleaned_catalog)}")
    print(f"Records in LandGuard zones: {len(filtered_catalog)}")

    out_file = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    filtered_catalog.to_csv(out_file, index=False)
    print(f"Saved filtered catalog: {out_file}")
    if not filtered_catalog.empty:
        print(filtered_catalog["zone_id"].value_counts().to_string())


if __name__ == "__main__":
    main()
