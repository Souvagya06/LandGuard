"""
train_agent_b.py

Trains Agent B: Dynamic Multi-Hazard Trigger Machine Learning Model for LandGuard AI.
Agent B fuses Agent A's baseline susceptibility prediction with live/historical precipitation
accumulations and intensity windows to predict landslide occurrence probability in real time.

Input:
    ml/data/processed/feature_table.csv
    ml/models/agent_a_susceptibility.pkl

Output:
    ml/models/agent_b_trigger.pkl

Usage:
    python train_agent_b.py
"""

import argparse
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

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "feature_table.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
AGENT_A_PATH = os.path.join(MODEL_DIR, "agent_a_susceptibility.pkl")
AGENT_B_OUT = os.path.join(MODEL_DIR, "agent_b_trigger.pkl")

AGENT_B_FEATURES = [
    "susceptibility_score",
    "rain_1d",
    "rain_3d_sum",
    "rain_7d_sum",
    "rain_14d_sum",
    "rain_30d_sum",
    "rain_max_7d",
    "api_7d",
]


def load_and_prepare_data(start_date="2017-01-01", end_date="2026-12-31"):
    """Load feature table and augment with Agent A susceptibility scores, filtered to date range."""
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Feature table not found at {DATA_PATH}. Run build_feature_table.py first.")
    if not os.path.exists(AGENT_A_PATH):
        raise FileNotFoundError(f"Agent A model not found at {AGENT_A_PATH}. Run train_agent_a.py first.")

    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df):,} rows from {os.path.basename(DATA_PATH)}")

    # Filter to specified temporal window
    df["date"] = pd.to_datetime(df["date"])
    if start_date:
        df = df[df["date"] >= pd.Timestamp(start_date)].copy()
    if end_date:
        df = df[df["date"] <= pd.Timestamp(end_date)].copy()
    print(f"Dataset filtered to {start_date} -> {end_date}: {len(df):,} rows retained.")

    # Load Agent A artifact
    with open(AGENT_A_PATH, "rb") as f:
        agent_a_bundle = pickle.load(f)
    agent_a_model = agent_a_bundle["model"]
    agent_a_features = agent_a_bundle["features"]

    print("Generating Agent A susceptibility scores across dataset...")
    df["susceptibility_score"] = agent_a_model.predict_proba(df[agent_a_features])[:, 1]

    # Temporal split: Use chronological holdout (e.g. 80% train, 20% test on event timeline)
    pos_dates = df.loc[df["landslide_occurred"] == 1, "date"]
    if not pos_dates.empty:
        split_date = pd.Timestamp(pos_dates.quantile(0.80)).normalize()
    else:
        split_date = pd.Timestamp(df["date"].quantile(0.80)).normalize()

    train_mask = df["date"] < split_date
    test_mask = df["date"] >= split_date

    train_df = df[train_mask].copy()
    test_df = df[test_mask].copy()

    print(f"Temporal Split (cutoff: {split_date.strftime('%Y-%m-%d')}) -> Train: {len(train_df):,} rows | Test: {len(test_df):,} rows")
    print(f"  Train Positives: {train_df['landslide_occurred'].sum():,} ({train_df['landslide_occurred'].mean()*100:.2f}%)")
    print(f"  Test Positives:  {test_df['landslide_occurred'].sum():,} ({test_df['landslide_occurred'].mean()*100:.2f}%)")

    if train_df["landslide_occurred"].nunique() < 2 or test_df["landslide_occurred"].nunique() < 2:
        raise ValueError(
            "Agent B requires both classes in the temporal train and test splits. "
            f"The dataset between {start_date} and {end_date} does not contain enough events in both splits."
        )

    X_train = train_df[AGENT_B_FEATURES]
    y_train = train_df["landslide_occurred"]

    X_test = test_df[AGENT_B_FEATURES]
    y_test = test_df["landslide_occurred"]

    return X_train, y_train, X_test, y_test, df


def train_agent_b(start_date="2017-01-01", end_date="2026-12-31"):
    print("=========================================================")
    print("     LandGuard AI: Training Agent B (Dynamic Trigger)    ")
    print("=========================================================")

    X_train, y_train, X_test, y_test, full_df = load_and_prepare_data(start_date, end_date)

    # Initialize HistGradientBoosting with class balancing and regularization
    model = HistGradientBoostingClassifier(
        max_iter=150,
        learning_rate=0.08,
        max_depth=5,
        min_samples_leaf=20,
        l2_regularization=2.0,
        class_weight="balanced",
        random_state=42,
    )

    print("\nFitting Agent B on training set...")
    model.fit(X_train, y_train)

    # Out-of-time Evaluation on Holdout test set
    print("\n--- Out-of-Time Test Set Evaluation ---")
    y_prob_test = model.predict_proba(X_test)[:, 1]
    y_pred_test = (y_prob_test >= 0.5).astype(int)

    auc_roc = roc_auc_score(y_test, y_prob_test)
    auc_pr = average_precision_score(y_test, y_prob_test)
    brier = brier_score_loss(y_test, y_prob_test)

    print(f"Test ROC-AUC:         {auc_roc:.4f}")
    print(f"Test PR-AUC:          {auc_pr:.4f}")
    print(f"Test Brier Score:     {brier:.4f}")
    print("\nClassification Report (Test Set):")
    print(classification_report(y_test, y_pred_test, target_names=["No Slide", "Landslide"]))

    cm = confusion_matrix(y_test, y_pred_test)
    print("Test Confusion Matrix:")
    print(f"  TN: {cm[0,0]:<6} | FP: {cm[0,1]:<6}")
    print(f"  FN: {cm[1,0]:<6} | TP: {cm[1,1]:<6}")

    # Permutation Feature Importance
    perm_imp = permutation_importance(model, X_test, y_test, n_repeats=5, random_state=42)

    print("\n--- Agent B Trigger Feature Importances ---")
    sorted_idx = perm_imp.importances_mean.argsort()[::-1]
    for idx in sorted_idx:
        feat = AGENT_B_FEATURES[idx]
        imp = perm_imp.importances_mean[idx]
        print(f"  {feat:<22}: {imp:.4f}")

    # Save the model that produced the reported out-of-time metrics. Do not
    # overwrite it with a full-dataset refit after evaluation.
    os.makedirs(MODEL_DIR, exist_ok=True)
    artifact = {
        "model": model,
        "features": AGENT_B_FEATURES,
        "version": "1.2.0-2017-2026",
        "description": "Agent B: Dynamic Landslide Hazard Trigger Classifier trained on 2017-2026 data",
        "date_range": {
            "start_date": start_date,
            "end_date": end_date,
        },
        "metrics": {
            "test_roc_auc": float(auc_roc),
            "test_pr_auc": float(auc_pr),
            "test_brier_score": float(brier),
        },
    }

    with open(AGENT_B_OUT, "wb") as f:
        pickle.dump(artifact, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"\n[SUCCESS] Agent B model saved to: {AGENT_B_OUT}")
    print(f"File Size: {os.path.getsize(AGENT_B_OUT) / 1024:.2f} KB")
    print("=========================================================\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train LandGuard Agent B Dynamic Trigger model.")
    parser.add_argument("--start-date", default="2017-01-01", help="Start date for training data (default: 2017-01-01)")
    parser.add_argument("--end-date", default="2026-12-31", help="End date for training data (default: 2026-12-31)")
    args = parser.parse_args()
    train_agent_b(start_date=args.start_date, end_date=args.end_date)

