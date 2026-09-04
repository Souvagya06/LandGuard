"""
fetch_rainfall_history.py

Pulls daily historical rainfall from Open-Meteo's free Archive API
(ERA5 reanalysis, no API key needed) across a grid of sample points
inside each monitoring zone, and saves the result to
ml/data/raw/open_meteo_archive/rainfall_history.csv

Each request is deliberately small (one point, one year at a time) -
batching many points/years into one request produces a large response
that is more likely to be interrupted on an unstable connection. Many
small, independently-retried requests are slower but far more reliable.

Zone boundaries come from zones_config.get_zone_bounds_from_dem() -
no coordinates are hardcoded here.

Requires: requests, pandas
    pip install requests pandas

Usage:
    python fetch_rainfall_history.py
    python fetch_rainfall_history.py --start-date 2019-01-01 --end-date 2026-01-01 --grid-size 4
"""

import argparse
import os
import time

import pandas as pd
import requests

try:
    from zones_config import get_zone_bounds_from_dem
except ImportError:
    from ml.scripts.zones_config import get_zone_bounds_from_dem

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

OUT_PATH_DEFAULT = os.path.join(
    os.path.dirname(__file__), "..", "data", "raw", "open_meteo_archive", "rainfall_history.csv"
)

MAX_RETRIES = 5
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.ChunkedEncodingError,
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


def build_sample_grid(bounds, grid_size):
    """Evenly spaced grid_size x grid_size lat/lon points spanning bounds."""
    min_lon, min_lat, max_lon, max_lat = bounds
    lons = [min_lon + (max_lon - min_lon) * i / (grid_size - 1) for i in range(grid_size)]
    lats = [min_lat + (max_lat - min_lat) * i / (grid_size - 1) for i in range(grid_size)]
    return [(lat, lon) for lat in lats for lon in lons]


def year_chunks(start_date, end_date):
    """Split a date range into whole-year (start_of_year..end_of_year)
    sub-ranges, clipped to the requested start/end - keeps each request
    small regardless of how many total years are requested."""
    start_year = int(start_date[:4])
    end_year = int(end_date[:4])
    chunks = []
    for year in range(start_year, end_year + 1):
        chunk_start = f"{year}-01-01" if year != start_year else start_date
        chunk_end = f"{year}-12-31" if year != end_year else end_date
        chunks.append((chunk_start, chunk_end))
    return chunks


def _get_with_retry(params):
    """GET one small request, retrying transient network errors."""
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(ARCHIVE_URL, params=params, timeout=60)
            resp.raise_for_status()
            return resp
        except RETRYABLE_EXCEPTIONS as error:
            last_error = error
            wait = min(2 ** attempt, 20)
            time.sleep(wait)
    raise last_error


def fetch_point_year(lat, lon, start_date, end_date):
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "precipitation_sum",
        "timezone": "UTC",
    }
    resp = _get_with_retry(params)
    return resp.json()


def fetch_zone_rainfall(zone_id, points, start_date, end_date):
    chunks = year_chunks(start_date, end_date)
    rows = []
    total_calls = len(points) * len(chunks)
    done = 0

    for lat, lon in points:
        for chunk_start, chunk_end in chunks:
            try:
                payload = fetch_point_year(lat, lon, chunk_start, chunk_end)
                daily = payload.get("daily", {})
                dates = daily.get("time", [])
                precip = daily.get("precipitation_sum", [])
                for date, value in zip(dates, precip):
                    rows.append(
                        {
                            "zone_id": zone_id,
                            "latitude": lat,
                            "longitude": lon,
                            "date": date,
                            "precipitation_mm": value,
                        }
                    )
            except Exception as error:
                print(f"    [{zone_id}] giving up on point ({lat:.4f},{lon:.4f}) "
                      f"{chunk_start}..{chunk_end} after {MAX_RETRIES} retries: {error}")

            done += 1
            if done % 10 == 0 or done == total_calls:
                print(f"    [{zone_id}] {done}/{total_calls} point-year request(s) complete")
            time.sleep(0.3)  # be polite to the free public API

    return pd.DataFrame(rows)


def parse_args():
    p = argparse.ArgumentParser(description="Fetch historical rainfall for each monitoring zone via Open-Meteo.")
    p.add_argument("--start-date", default="2019-01-01", help="e.g. 2019-01-01")
    p.add_argument("--end-date", default="2026-01-01", help="e.g. 2026-01-01")
    p.add_argument("--grid-size", type=int, default=4, help="NxN sample points per zone (default 4x4=16 points)")
    p.add_argument("--out", default=OUT_PATH_DEFAULT, help="Output CSV path")
    return p.parse_args()


def main():
    args = parse_args()

    print("Target zones (derived from downloaded DEM extents):")
    zone_bounds = get_zone_bounds_from_dem()

    all_dfs = []
    for zone_id, bounds in zone_bounds.items():
        points = build_sample_grid(bounds, args.grid_size)
        print(f"\n[{zone_id}] fetching rainfall for {len(points)} sample point(s), "
              f"{args.start_date} to {args.end_date} (one point-year per request) ...")
        df = fetch_zone_rainfall(zone_id, points, args.start_date, args.end_date)
        print(f"[{zone_id}] {len(df)} daily record(s) retrieved")
        all_dfs.append(df)

    combined = pd.concat(all_dfs, ignore_index=True) if all_dfs else pd.DataFrame()

    out_file = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    combined.to_csv(out_file, index=False)
    print(f"\nSaved rainfall history to: {out_file}")

    if not combined.empty:
        print("\nRecords per zone:")
        print(combined["zone_id"].value_counts().to_string())


if __name__ == "__main__":
    main()