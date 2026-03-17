from __future__ import annotations

import pandas as pd

try:
    import tradealytics_core
    _USE_CPP = True
except ImportError:
    _USE_CPP = False


def detect_loss_aversion(df: pd.DataFrame) -> dict:
    if df.empty:
        return {
            "score": 0.0,
            "flags": [],
            "evidence": [],
            "stats": {
                "avg_loser_hold_minutes": 0.0,
                "avg_winner_hold_minutes": 0.0,
                "loser_to_winner_hold_ratio": 0.0,
                "avg_loss_size": 0.0,
                "avg_win_size": 0.0,
                "loss_to_win_ratio": 0.0,
                "risk_reward_ratio": 0.0,
            },
        }

    hold = df["hold_minutes"].fillna(0.0).tolist()

    result = tradealytics_core.detect_loss_aversion(
        df["timestamp"].astype("int64").tolist(),
        df["pnl"].tolist(),
        hold,
    )

    s = result.stats
    rr = s.get("risk_reward_ratio", 0.0)

    stats = {
        "avg_loser_hold_minutes": round(s["avg_loser_hold_minutes"], 2),
        "avg_winner_hold_minutes": round(s["avg_winner_hold_minutes"], 2),
        "loser_to_winner_hold_ratio": round(s["loser_to_winner_hold_ratio"], 3),
        "avg_loss_size": round(s["avg_loss_size"], 2),
        "avg_win_size": round(s["avg_win_size"], 2),
        "loss_to_win_ratio": round(s["loss_to_win_ratio"], 3),
        "risk_reward_ratio": round(rr, 3),
    }

    evidence = [
        {"metric": "avg_loser_hold_minutes", "value": stats["avg_loser_hold_minutes"],
         "note": "Mean hold duration for losing trades."},
        {"metric": "avg_winner_hold_minutes", "value": stats["avg_winner_hold_minutes"],
         "note": "Mean hold duration for winning trades."},
        {"metric": "loser_to_winner_hold_ratio", "value": stats["loser_to_winner_hold_ratio"],
         "note": "Values above 1.0 indicate longer hold time on losers."},
        {"metric": "avg_loss_size", "value": stats["avg_loss_size"],
         "note": "Mean absolute loss per losing trade."},
        {"metric": "avg_win_size", "value": stats["avg_win_size"],
         "note": "Mean profit per winning trade."},
        {"metric": "loss_to_win_ratio", "value": stats["loss_to_win_ratio"],
         "note": "Avg loss / avg win. Above 1.0 means losses are larger than wins."},
        {"metric": "risk_reward_ratio", "value": stats["risk_reward_ratio"],
         "note": "Avg win / avg loss. Below 1.0 suggests poor risk management."},
    ]

    return {
        "score": result.score,
        "flags": result.flag_indices,
        "evidence": evidence,
        "stats": stats,
    }
