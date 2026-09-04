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


def load_and_prepare_data():
    """Load feature table and augment with Agent A susceptibility scores."""
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Feature table not found at {DATA_PATH}. Run build_feature_table.py first.")
    if not os.path.exists(AGENT_A_PATH):
        raise FileNotFoundError(f"Agent A model not found at {AGENT_A_PATH}. Run train_agent_a.py first.")

    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df):,} rows from {os.path.basename(DATA_PATH)}")

    # Load Agent A artifact
    with open(AGENT_A_PATH, "rb") as f:
        agent_a_bundle = pickle.load(f)
    agent_a_model = agent_a_bundle["model"]
    agent_a_features = agent_a_bundle["features"]

    print("Generating Agent A susceptibility scores across dataset...")
    df["susceptibility_score"] = agent_a_model.predict_proba(df[agent_a_features])[:, 1]

    # Temporal split: Train on 2019-2023, Test out-of-time on 2024-2026
    df["date"] = pd.to_datetime(df["date"])
    split_date = pd.Timestamp("2024-01-01")

    train_mask = df["date"] < split_date
    test_mask = df["date"] >= split_date

    train_df = df[train_mask].copy()
    test_df = df[test_mask].copy()

    print(f"Temporal Split -> Train (2019-2023): {len(train_df):,} rows | Test (2024-2026): {len(test_df):,} rows")
    print(f"  Train Positives: {train_df['landslide_occurred'].sum():,} ({train_df['landslide_occurred'].mean()*100:.2f}%)")
    print(f"  Test Positives:  {test_df['landslide_occurred'].sum():,} ({test_df['landslide_occurred'].mean()*100:.2f}%)")

    X_train = train_df[AGENT_B_FEATURES]
    y_train = train_df["landslide_occurred"]

    X_test = test_df[AGENT_B_FEATURES]
    y_test = test_df["landslide_occurred"]

    return X_train, y_train, X_test, y_test, df


def train_agent_b():
    print("=========================================================")
    print("     LandGuard AI: Training Agent B (Dynamic Trigger)    ")
    print("=========================================================")

    X_train, y_train, X_test, y_test, full_df = load_and_prepare_data()

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

    # Out-of-time Evaluation on Unseen 2024-2026 data
    print("\n--- Out-of-Time Test Set Evaluation (2024–2026) ---")
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

    # Retrain on full dataset for maximum deployment accuracy
    print("\nFitting final production Agent B model across full dataset...")
    X_full = full_df[AGENT_B_FEATURES]
    y_full = full_df["landslide_occurred"]
    model.fit(X_full, y_full)

    # Save artifact
    os.makedirs(MODEL_DIR, exist_ok=True)
    artifact = {
        "model": model,
        "features": AGENT_B_FEATURES,
        "version": "1.0.0",
        "description": "Agent B: Dynamic Landslide Hazard Trigger Classifier",
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
    train_agent_b()
