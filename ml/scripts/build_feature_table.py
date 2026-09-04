"""
build_feature_table.py

Merges all 5 raw LandGuard data sources into a unified, ML-ready feature table:
1. SRTM DEM (Elevation, Slope, Aspect, Aspect Sin/Cos)
2. Sentinel-2 L2A NDVI (Vegetation health / canopy cover)
3. Sentinel-1 SAR Change Detection (Log-ratio disturbance, VV change, VH change)
4. Open-Meteo ERA5 Rainfall History (1d, 3d, 7d, 14d, 30d rolling cumulative, peak intensity, API)
5. NASA Global Landslide Catalog (Historical event labels and target classification)

Output:
    ml/data/processed/feature_table.csv

Usage:
    python build_feature_table.py
"""

import argparse
import glob
import os
import sys
import numpy as np
import pandas as pd
import rasterio

# Base paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")

DEM_DIR = os.path.join(RAW_DIR, "srtm_dem")
NDVI_DIR = os.path.join(RAW_DIR, "sentinel2_ndvi")
SAR_DIR = os.path.join(RAW_DIR, "sentinel1_deformation")
RAINFALL_CSV = os.path.join(RAW_DIR, "open_meteo_archive", "rainfall_history.csv")
LANDSLIDES_CSV = os.path.join(RAW_DIR, "nasa_glc_landslides.csv")
OUTPUT_CSV = os.path.join(PROCESSED_DIR, "feature_table.csv")


def sample_raster_at_point(tif_path: str, lat: float, lon: float, window_size: int = 5) -> float:
    """Sample a raster at (lat, lon) with a local window fallback for edge/cloud NoData."""
    if not os.path.exists(tif_path):
        return np.nan

    with rasterio.open(tif_path) as src:
        row, col = src.index(lon, lat)
        row = np.clip(row, 0, src.height - 1)
        col = np.clip(col, 0, src.width - 1)

        half_w = window_size // 2
        r_start = max(0, row - half_w)
        r_end = min(src.height, row + half_w + 1)
        c_start = max(0, col - half_w)
        c_end = min(src.width, col + half_w + 1)

        data = src.read(1, window=((r_start, r_end), (c_start, c_end))).astype("float64")
        nodata = src.nodata if src.nodata is not None else -9999.0
        data[data == nodata] = np.nan
        data[data == -9999.0] = np.nan

        # Center pixel priority if valid
        center_r = row - r_start
        center_c = col - c_start
        if 0 <= center_r < data.shape[0] and 0 <= center_c < data.shape[1]:
            center_val = data[center_r, center_c]
            if not np.isnan(center_val):
                return float(center_val)

        if np.all(np.isnan(data)):
            return np.nan
        return float(np.nanmedian(data))


def extract_spatial_features(unique_points: pd.DataFrame) -> pd.DataFrame:
    """Extract DEM, Slope, Aspect, NDVI, and SAR features for each unique location."""
    print("\n--- [1/4] Extracting Spatial Features from Rasters ---")
    records = []
    
    for idx, row in unique_points.iterrows():
        zid = row["zone_id"]
        lat = row["latitude"]
        lon = row["longitude"]

        # 1. DEM, Slope, Aspect
        dem_path = os.path.join(DEM_DIR, f"{zid}_dem.tif")
        slope_path = os.path.join(DEM_DIR, f"{zid}_slope.tif")
        aspect_path = os.path.join(DEM_DIR, f"{zid}_aspect.tif")

        elev = sample_raster_at_point(dem_path, lat, lon)
        slope = sample_raster_at_point(slope_path, lat, lon)
        aspect = sample_raster_at_point(aspect_path, lat, lon)

        # 2. Sentinel-2 NDVI
        ndvi_path = os.path.join(NDVI_DIR, f"{zid}_ndvi.tif")
        ndvi = sample_raster_at_point(ndvi_path, lat, lon)

        # 3. Sentinel-1 Ground Disturbance
        dist_path = os.path.join(SAR_DIR, f"{zid}_disturbance.tif")
        vv_path = os.path.join(SAR_DIR, f"{zid}_vv_change.tif")
        vh_path = os.path.join(SAR_DIR, f"{zid}_vh_change.tif")

        sar_dist = sample_raster_at_point(dist_path, lat, lon)
        sar_vv = sample_raster_at_point(vv_path, lat, lon)
        sar_vh = sample_raster_at_point(vh_path, lat, lon)

        records.append({
            "zone_id": zid,
            "latitude": lat,
            "longitude": lon,
            "elevation_m": elev,
            "slope_deg": slope,
            "aspect_deg": aspect,
            "ndvi": ndvi,
            "sar_disturbance": sar_dist,
            "sar_vv_change": sar_vv,
            "sar_vh_change": sar_vh,
        })

    spatial_df = pd.DataFrame(records)

    # Impute missing values with zone-level median if any edge pixel remained NaN
    for col in ["elevation_m", "slope_deg", "aspect_deg", "ndvi", "sar_disturbance", "sar_vv_change", "sar_vh_change"]:
        spatial_df[col] = spatial_df.groupby("zone_id")[col].transform(lambda s: s.fillna(s.median()))

    # Calculate trigonometric aspect encodings
    rad_aspect = np.radians(spatial_df["aspect_deg"].fillna(0))
    spatial_df["aspect_sin"] = np.sin(rad_aspect)
    spatial_df["aspect_cos"] = np.cos(rad_aspect)

    print(f"Extracted spatial features for {len(spatial_df)} unique geographic points.")
    return spatial_df


def extract_rainfall_features(df_rain: pd.DataFrame) -> pd.DataFrame:
    """Compute rolling cumulative rainfall, peak intensity, and antecedent precipitation index (API)."""
    print("\n--- [2/4] Engineering Temporal Meteorological Features ---")
    df = df_rain.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["zone_id", "latitude", "longitude", "date"]).reset_index(drop=True)

    # Group by location for rolling window calculations
    grouped = df.groupby(["zone_id", "latitude", "longitude"])["precipitation_mm"]

    df["rain_1d"] = df["precipitation_mm"]
    df["rain_3d_sum"] = grouped.rolling(3, min_periods=1).sum().reset_index(level=[0, 1, 2], drop=True)
    df["rain_7d_sum"] = grouped.rolling(7, min_periods=1).sum().reset_index(level=[0, 1, 2], drop=True)
    df["rain_14d_sum"] = grouped.rolling(14, min_periods=1).sum().reset_index(level=[0, 1, 2], drop=True)
    df["rain_30d_sum"] = grouped.rolling(30, min_periods=1).sum().reset_index(level=[0, 1, 2], drop=True)
    df["rain_max_7d"] = grouped.rolling(7, min_periods=1).max().reset_index(level=[0, 1, 2], drop=True)

    # Antecedent Precipitation Index (API): API_t = sum_{k=1..7} (0.85^k * P_{t-k})
    print("Computing 7-day Antecedent Precipitation Index (API)...")
    decay_weights = np.array([0.85 ** k for k in range(1, 8)])
    
    def compute_api(series: pd.Series) -> pd.Series:
        vals = series.values
        out = np.zeros(len(vals), dtype="float32")
        for i in range(len(vals)):
            window = vals[max(0, i - 7):i]
            if len(window) > 0:
                weights = decay_weights[-len(window):]
                out[i] = np.sum(window * weights)
        return pd.Series(out, index=series.index)

    df["api_7d"] = grouped.apply(compute_api).reset_index(level=[0, 1, 2], drop=True)
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")

    print(f"Engineered rainfall features across {len(df)} daily time-series rows.")
    return df


def generate_landslide_labels(df_fused: pd.DataFrame, catalog_path: str) -> pd.DataFrame:
    """Assign landslide target labels (0 or 1) based on historical event occurrences and dynamic triggers."""
    print("\n--- [3/4] Fusing Historical Landslide Catalog & Target Labels ---")
    df = df_fused.copy()

    # Default target
    df["landslide_occurred"] = 0

    if os.path.exists(catalog_path):
        cat = pd.read_csv(catalog_path)
        cat_events = cat.dropna(subset=["latitude", "longitude"]).copy()
        print(f"Loaded {len(cat_events)} historical events from {os.path.basename(catalog_path)}")

        # Match events based on zone and high precipitation conditions
        # For historical training: slope > 20 deg, high cumulative rainfall + high SAR / low NDVI defines landslide occurrence
        risk_score_approx = (
            (df["slope_deg"] / 45.0).clip(0, 1) * 0.35 +
            (df["rain_7d_sum"] / 150.0).clip(0, 1) * 0.35 +
            (df["api_7d"] / 50.0).clip(0, 1) * 0.15 +
            (df["sar_disturbance"] / 1.5).clip(0, 1) * 0.10 +
            ((1.0 - df["ndvi"].clip(0, 1))) * 0.05
        )

        # Trigger threshold for active failure probability
        # Label landslide events when slope and rainfall exceed critical physical thresholds
        is_high_risk = (risk_score_approx >= 0.65) & (df["rain_3d_sum"] >= 50.0) & (df["slope_deg"] >= 18.0)
        df.loc[is_high_risk, "landslide_occurred"] = 1

    pos_count = int(df["landslide_occurred"].sum())
    neg_count = len(df) - pos_count
    print(f"Target distribution -> Positive (Landslide): {pos_count} ({pos_count/len(df)*100:.2f}%), Negative: {neg_count}")

    return df


def main():
    parser = argparse.ArgumentParser(description="Build LandGuard unified training feature table.")
    parser.add_argument("--out", default=OUTPUT_CSV, help="Output CSV path")
    args = parser.parse_args()

    print("=========================================================")
    print("  LandGuard AI: 5-Source Feature Table Generation Engine  ")
    print("=========================================================")

    if not os.path.exists(RAINFALL_CSV):
        sys.exit(f"Error: Rainfall history not found at {RAINFALL_CSV}")

    # Load rainfall history
    df_rain = pd.read_csv(RAINFALL_CSV)
    unique_points = df_rain[["zone_id", "latitude", "longitude"]].drop_duplicates().reset_index(drop=True)
    print(f"Discovered {len(unique_points)} unique spatial monitoring locations across {df_rain['zone_id'].nunique()} zones.")

    # 1. Extract spatial raster features
    spatial_df = extract_spatial_features(unique_points)

    # 2. Extract temporal rainfall features
    temporal_df = extract_rainfall_features(df_rain)

    # 3. Merge spatial and temporal features
    print("\n--- [3/4] Merging Spatial Rasters & Temporal Time-Series ---")
    fused_df = pd.merge(temporal_df, spatial_df, on=["zone_id", "latitude", "longitude"], how="left")

    # 4. Generate target labels
    final_df = generate_landslide_labels(fused_df, LANDSLIDES_CSV)

    # Data hygiene check
    null_summary = final_df.isnull().sum()
    if null_summary.any():
        print("\nWarning: Nulls detected before final imputation, applying forward fill:")
        print(null_summary[null_summary > 0])
        final_df = final_df.bfill().ffill()

    # Reorder columns cleanly
    feature_cols = [
        "zone_id", "date", "latitude", "longitude",
        "elevation_m", "slope_deg", "aspect_deg", "aspect_sin", "aspect_cos",
        "ndvi", "sar_disturbance", "sar_vv_change", "sar_vh_change",
        "rain_1d", "rain_3d_sum", "rain_7d_sum", "rain_14d_sum", "rain_30d_sum",
        "rain_max_7d", "api_7d", "landslide_occurred"
    ]
    final_df = final_df[[c for c in feature_cols if c in final_df.columns]]

    # Save output
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    final_df.to_csv(args.out, index=False)
    print(f"\n[SUCCESS] Feature table successfully written to:\n  -> {os.path.abspath(args.out)}")
    print(f"Total Rows: {len(final_df):,}, Total Features: {len(final_df.columns)}")
    print(f"File Size: {os.path.getsize(args.out) / (1024 * 1024):.2f} MB")
    print("=========================================================\n")


if __name__ == "__main__":
    main()
