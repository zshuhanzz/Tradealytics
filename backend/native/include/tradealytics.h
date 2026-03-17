#pragma once

#include <string>
#include <vector>
#include <unordered_map>

struct DetectorResult {
    double score;
    std::vector<int> flag_indices;
    std::unordered_map<std::string, double> stats;
};

DetectorResult detect_overtrading(
    const std::vector<double>& timestamps,
    const std::vector<std::string>& sides,
    const std::vector<std::string>& symbols,
    const std::vector<double>& quantities,
    const std::vector<double>& pnl,
    int trades_per_day_threshold = 15,
    int burst_window_minutes = 10,
    int burst_threshold = 5
);

DetectorResult detect_loss_aversion(
    const std::vector<double>& timestamps,
    const std::vector<double>& pnl,
    const std::vector<double>& hold_minutes
);

DetectorResult detect_revenge_trading(
    const std::vector<double>& timestamps,
    const std::vector<double>& pnl,
    const std::vector<double>& quantities,
    int reentry_window_minutes = 15,
    double size_multiplier_threshold = 1.25,
    int streak_threshold = 2
);

std::vector<double> extract_features(
    const std::vector<double>& timestamps,
    const std::vector<double>& pnl,
    const std::vector<double>& quantities,
    const std::vector<std::string>& sides,
    const std::vector<double>& prices,
    const std::vector<double>& balance
);
