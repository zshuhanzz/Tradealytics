from __future__ import annotations

import pandas as pd

import tradealytics_core


def detect_revenge_trading(
    df: pd.DataFrame,
    reentry_window_minutes: int = 15,
    size_multiplier_threshold: float = 1.25,
    streak_threshold: int = 2,
) -> dict:
    if df.empty:
        return {
            "score": 0.0,
            "flags": [],
            "evidence": [],
            "stats": {"revenge_events": 0, "event_rate": 0.0, "streak_events": 0},
        }

    result = tradealytics_core.detect_revenge_trading(
        df["timestamp"].astype("int64").tolist(),
        df["pnl"].tolist(),
        df["quantity"].tolist(),
        reentry_window_minutes,
        size_multiplier_threshold,
        streak_threshold,
    )

    s = result.stats
    stats = {
        "revenge_events": int(s["revenge_events"]),
        "event_rate": round(s["event_rate"], 3),
        "streak_events": int(s["streak_events"]),
    }

    evidence = [
        {"metric": "revenge_events", "value": stats["revenge_events"],
         "note": "Rapid larger re-entries after a single loss."},
        {"metric": "streak_events", "value": stats["streak_events"],
         "note": f"Increased size after {streak_threshold}+ consecutive losses."},
        {"metric": "event_rate", "value": stats["event_rate"],
         "note": "Total revenge events per trade in sample."},
        {"metric": "reentry_window_minutes", "value": reentry_window_minutes,
         "note": "Configured time window for re-entry detection."},
    ]

    return {
        "score": result.score,
        "flags": result.flag_indices,
        "evidence": evidence,
        "stats": stats,
    }
