from __future__ import annotations

import pandas as pd

import tradealytics_core


def detect_overtrading(
    df: pd.DataFrame,
    trades_per_day_threshold: int = 15,
    burst_window_minutes: int = 10,
    burst_threshold: int = 5,
) -> dict:
    if df.empty:
        return {
            "score": 0.0,
            "flags": [],
            "evidence": [],
            "stats": {
                "avg_trades_per_day": 0.0,
                "max_trades_per_day": 0,
                "max_burst_trades": 0,
                "position_switches": 0,
            },
        }

    result = tradealytics_core.detect_overtrading(
        df["timestamp"].astype("int64").tolist(),
        df["side"].tolist(),
        df["symbol"].tolist(),
        df["quantity"].tolist(),
        df["pnl"].tolist(),
        trades_per_day_threshold,
        burst_window_minutes,
        burst_threshold,
    )

    stats = {
        "avg_trades_per_day": round(result.stats["avg_trades_per_day"], 2),
        "max_trades_per_day": int(result.stats["max_trades_per_day"]),
        "max_burst_trades": int(result.stats["max_burst_trades"]),
        "position_switches": int(result.stats["position_switches"]),
    }

    evidence = [
        {"metric": "avg_trades_per_day", "value": stats["avg_trades_per_day"],
         "note": f"Threshold: {trades_per_day_threshold} trades/day."},
        {"metric": "max_trades_per_day", "value": stats["max_trades_per_day"],
         "note": "Highest daily activity in the sample."},
        {"metric": "max_burst_trades", "value": stats["max_burst_trades"],
         "note": f"Max trades in any {burst_window_minutes}-minute window."},
        {"metric": "position_switches", "value": stats["position_switches"],
         "note": "Rapid buy\u2194sell flips on same symbol within 5 min."},
    ]

    return {
        "score": result.score,
        "flags": result.flag_indices,
        "evidence": evidence,
        "stats": stats,
    }
