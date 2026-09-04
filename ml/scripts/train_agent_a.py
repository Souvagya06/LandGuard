"""
train_agent_a.py

Trains Agent A: Spatial Susceptibility Machine Learning Model for LandGuard AI.
Agent A evaluates static terrain, vegetation, and ground deformation features to
produce a baseline spatial landslide susceptibility score (0.0 - 1.0), invariant of short-term weather.

Input:
    ml/data/processed/feature_table.csv

Output:
    ml/models/agent_a_susceptibility.pkl

Usage:
    python train_agent_a.py
"""

import os
import pickle
import numpy as np
import pandas as pd

from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    brier_score_loss,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "feature_table.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_OUT = os.path.join(MODEL_DIR, "agent_a_susceptibility.pkl")

# Spatial Susceptibility Feature Set
AGENT_A_FEATURES = [
    "elevation_m",
    "slope_deg",
    "aspect_sin",
    "aspect_cos",
    "ndvi",
    "sar_disturbance",
    "sar_vv_change",
    "sar_vh_change",
]


def load_spatial_data(csv_path: str):
    """Load dataset and extract spatial points and susceptibility targets."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Feature table not found at {csv_path}. Run build_feature_table.py first.")

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df):,} total feature rows from {os.path.basename(csv_path)}")

    # Distinct spatial profiles across zones
    spatial_df = df.groupby(["zone_id", "latitude", "longitude"])[AGENT_A_FEATURES].mean().reset_index()
    print(f"Extracted {len(spatial_df)} unique geographic monitoring sites.")

    # Spatial Susceptibility target based on geomorphology:
    # High slope, elevated SAR disturbance, and lower vegetation density define high susceptibility
    slope_norm = (spatial_df["slope_deg"] / 45.0).clip(0, 1)
    sar_norm = (spatial_df["sar_disturbance"] / 1.5).clip(0, 1)
    veg_norm = (1.0 - spatial_df["ndvi"].clip(0, 1))
    
    spatial_risk_score = (
        0.50 * slope_norm +
        0.30 * sar_norm +
        0.20 * veg_norm
    )

    # Threshold for susceptible vs stable terrain (top 35% most susceptible slopes)
    threshold = spatial_risk_score.quantile(0.65)
    spatial_df["susceptible"] = (spatial_risk_score >= threshold).astype(int)
    
    pos_count = int(spatial_df["susceptible"].sum())
    print(f"Susceptibility Distribution -> High Hazard: {pos_count}, Stable/Low: {len(spatial_df) - pos_count}")

    X = spatial_df[AGENT_A_FEATURES]
    y = spatial_df["susceptible"]
    groups = spatial_df["zone_id"]

    return X, y, groups, spatial_df


def train_agent_a():
    print("=========================================================")
    print("      LandGuard AI: Training Agent A (Susceptibility)     ")
    print("=========================================================")

    X, y, groups, spatial_df = load_spatial_data(DATA_PATH)

    # Initialize robust gradient boosting classifier
    model = HistGradientBoostingClassifier(
        max_iter=100,
        learning_rate=0.05,
        max_depth=4,
        min_samples_leaf=2,
        l2_regularization=1.0,
        random_state=42,
    )

    # Stratified K-Fold Cross-Validation
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    y_prob_cv = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
    y_pred_cv = (y_prob_cv >= 0.5).astype(int)

    # Calculate Evaluation Metrics
    auc_roc = roc_auc_score(y, y_prob_cv)
    auc_pr = average_precision_score(y, y_prob_cv)
    brier = brier_score_loss(y, y_prob_cv)

    print("\n--- Cross-Validation Metrics (Agent A) ---")
    print(f"ROC-AUC Score:        {auc_roc:.4f}")
    print(f"PR-AUC Score:         {auc_pr:.4f}")
    print(f"Brier Score Loss:     {brier:.4f}")
    print("\nClassification Report:")
    print(classification_report(y, y_pred_cv, target_names=["Stable", "Susceptible"]))

    print("Confusion Matrix:")
    cm = confusion_matrix(y, y_pred_cv)
    print(f"  TN: {cm[0,0]} | FP: {cm[0,1]}")
    print(f"  FN: {cm[1,0]} | TP: {cm[1,1]}")

    # Train Final Production Model on Full Dataset
    print("\nFitting full production Agent A pipeline...")
    model.fit(X, y)

    # Feature Importance estimation (via standard permutation on training set)
    perm_imp = permutation_importance(model, X, y, n_repeats=10, random_state=42)
    
    print("\n--- Agent A Feature Importances ---")
    sorted_idx = perm_imp.importances_mean.argsort()[::-1]
    for idx in sorted_idx:
        feat = AGENT_A_FEATURES[idx]
        imp = perm_imp.importances_mean[idx]
        print(f"  {feat:<20}: {imp:.4f}")

    # Package model artifact with inference bundle
    os.makedirs(MODEL_DIR, exist_ok=True)
    artifact = {
        "model": model,
        "features": AGENT_A_FEATURES,
        "version": "1.0.0",
        "description": "Agent A: Spatial Landslide Susceptibility Classifier",
        "metrics": {
            "roc_auc": float(auc_roc),
            "pr_auc": float(auc_pr),
            "brier_score": float(brier),
        },
    }

    with open(MODEL_OUT, "wb") as f:
        pickle.dump(artifact, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"\n[SUCCESS] Agent A model saved to: {MODEL_OUT}")
    print(f"File Size: {os.path.getsize(MODEL_OUT) / 1024:.2f} KB")
    print("=========================================================\n")


if __name__ == "__main__":
    train_agent_a()
