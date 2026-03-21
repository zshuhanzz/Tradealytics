"""
Feature engineering for bias classification.

Extracts per-window behavioral features from raw trade data via the C++ core module.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import tradealytics_core

FEATURE_NAMES: list[str] = [
    "trades_per_hour",
    "mean_time_between_trades_sec",
    "std_time_between_trades_sec",
    "burst_count_60s",
    "pnl_mean",
    "pnl_std",
    "win_rate",
    "avg_quantity",
    "std_quantity",
    "avg_trade_value",
    "loss_hold_to_win_hold_ratio",
    "avg_size_after_loss_ratio",
    "reentry_after_loss_mean_sec",
    "consecutive_loss_streak_max",
    "side_switch_rate",
    "balance_drawdown_pct",
]


def extract_features(df: pd.DataFrame) -> np.ndarray:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df = df.sort_values("timestamp").reset_index(drop=True)

    if len(df) < 2:
        return np.zeros(len(FEATURE_NAMES), dtype=float)

    price_col = "entry_price" if "entry_price" in df.columns else "price" if "price" in df.columns else None
    prices = df[price_col].astype(float).tolist() if price_col else [1.0] * len(df)
    balance = df["balance"].astype(float).tolist() if "balance" in df.columns else []

    feat = tradealytics_core.extract_features(
        df["timestamp"].astype("int64").tolist(),
        df["pnl"].astype(float).tolist(),
        df["quantity"].astype(float).tolist(),
        df["side"].tolist(),
        prices,
        balance,
    )

    return np.array(feat, dtype=float)


def extract_windowed_features(
    df: pd.DataFrame,
    window_size: int = 50,
    stride: int = 25,
) -> list[np.ndarray]:
    features = []
    for start in range(0, len(df) - window_size + 1, stride):
        window = df.iloc[start: start + window_size]
        features.append(extract_features(window))
    return features
