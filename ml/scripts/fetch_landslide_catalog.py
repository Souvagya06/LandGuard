"""
fetch_landslide_catalog.py

Pulls the NASA Global Landslide Catalog (GLC), filters records down to
the target Arunachal Pradesh monitoring zones, and writes the result to
ml/data/raw/nasa_glc_landslides.csv for use as ground-truth landslide labels.

Uses the central ZONE_BOUNDS from zones_config.py matching:
  - west_siang_arunachal_pradesh
  - lower_subansiri_arunachal_pradesh
  - papum_pare_arunachal_pradesh

Requires: requests, pandas
    pip install requests pandas
"""

import argparse
import os
import sys

import pandas as pd
import requests

try:
    from zones_config import ZONE_BOUNDS, get_zone_bounds_from_dem
except ImportError:
    from ml.scripts.zones_config import ZONE_BOUNDS, get_zone_bounds_from_dem

# Default URLs hosting the NASA Global Landslide Catalog export
PRIMARY_DATA_URL = "https://raw.githubusercontent.com/abhaychaudhary18/Global-Landslide-Data-Analysis-using-Python/main/Global_Landslide_Catalog_Export.csv"
FALLBACK_DATA_URL = "https://raw.githubusercontent.com/aaditya620321/Global_Landslide_Catalog_ML/main/Global%20Landslide%20Catalog.csv"

OUT_PATH_DEFAULT = os.path.join(
    os.path.dirname(__file__), "..", "data", "raw", "nasa_glc_landslides.csv"
)


def download_catalog(source_url: str = PRIMARY_DATA_URL) -> pd.DataFrame:
    """Download or load the NASA Global Landslide Catalog CSV."""
    # If source is a local file path
    if os.path.exists(source_url):
        print(f"Loading local catalog file: {source_url}")
        return pd.read_csv(source_url, low_memory=False)

    urls = [source_url, FALLBACK_DATA_URL]
    for url in urls:
        try:
            print(f"Downloading NASA GLC dataset from:\n  {url}")
            resp = requests.get(url, timeout=60, stream=True)
            resp.raise_for_status()

            # Read into DataFrame
            df = pd.read_csv(url, low_memory=False)
            print(f"Successfully downloaded {len(df)} catalog records.")
            return df
        except Exception as e:
            print(f"Download failed from {url}: {e}")

    raise RuntimeError(
        "Could not download NASA Global Landslide Catalog from remote sources. "
        "Please check your internet connection or provide a local CSV file with --source."
    )


def clean_dataframe(df: pd.DataFrame, min_date: str = None, max_date: str = None) -> pd.DataFrame:
    """Clean coordinates and apply date filters."""
    df = df.copy()

    # Coerce latitude and longitude to numeric
    for col in ("latitude", "longitude"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["latitude", "longitude"])

    # Optional date filtering
    if "event_date" in df.columns and (min_date or max_date):
        df["event_date_parsed"] = pd.to_datetime(df["event_date"], errors="coerce")
        if min_date:
            min_dt = pd.to_datetime(min_date)
            df = df[df["event_date_parsed"] >= min_dt]
        if max_date:
            max_dt = pd.to_datetime(max_date)
            df = df[df["event_date_parsed"] <= max_dt]
        df = df.drop(columns=["event_date_parsed"])

    return df


def assign_zone(row, zone_bounds):
    """Check if point falls within any zone bounding box [min_lon, min_lat, max_lon, max_lat]."""
    lat, lon = row["latitude"], row["longitude"]
    for zone_id, (min_lon, min_lat, max_lon, max_lat) in zone_bounds.items():
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            return zone_id
    return None


def filter_to_zones(df: pd.DataFrame, zone_bounds: dict) -> pd.DataFrame:
    """Filter records to those within the defined zones and assign zone_id."""
    df = df.copy()
    df["zone_id"] = df.apply(lambda r: assign_zone(r, zone_bounds), axis=1)
    filtered = df[df["zone_id"].notna()].reset_index(drop=True)
    return filtered


def parse_args():
    p = argparse.ArgumentParser(
        description="Fetch + filter NASA Global Landslide Catalog for Arunachal Pradesh target zones."
    )
    p.add_argument(
        "--source",
        default=PRIMARY_DATA_URL,
        help="Remote URL or local path to NASA GLC export CSV",
    )
    p.add_argument("--min-date", default=None, help="Optional lower bound, e.g. 2005-01-01")
    p.add_argument("--max-date", default=None, help="Optional upper bound, e.g. 2024-12-31")
    p.add_argument("--out", default=OUT_PATH_DEFAULT, help="Output CSV path")
    return p.parse_args()


def main():
    args = parse_args()

    # Load zone bounding boxes (using DEM bounds if available, else zones_config)
    zone_bounds = get_zone_bounds_from_dem()
    print("Target Arunachal Pradesh Zones:")
    for zid, bounds in zone_bounds.items():
        print(f"  - {zid}: [minLon={bounds[0]:.4f}, minLat={bounds[1]:.4f}, maxLon={bounds[2]:.4f}, maxLat={bounds[3]:.4f}]")

    print("\nFetching NASA Global Landslide Catalog records...")
    df_raw = download_catalog(source_url=args.source)

    df_cleaned = clean_dataframe(df_raw, min_date=args.min_date, max_date=args.max_date)
    print(f"Total valid global records: {len(df_cleaned)}")

    filtered = filter_to_zones(df_cleaned, zone_bounds)
    print(f"\nRecords falling inside Arunachal Pradesh target zones: {len(filtered)}")

    if len(filtered) == 0:
        print(
            "WARNING: Zero records matched the zone bounding boxes. "
            "Please check ZONE_BOUNDS or date filters."
        )

    out_file = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    filtered.to_csv(out_file, index=False)
    print(f"Saved filtered catalog to: {out_file}")

    if len(filtered) > 0:
        print("\nBreakdown by zone:")
        print(filtered["zone_id"].value_counts().to_string())

        # Show brief preview of columns
        preview_cols = [c for c in ["event_id", "event_date", "zone_id", "landslide_category", "location_description"] if c in filtered.columns]
        print("\nSample records:")
        print(filtered[preview_cols].head(5).to_string())


if __name__ == "__main__":
    main()