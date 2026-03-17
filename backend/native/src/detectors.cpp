#include "tradealytics.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <numeric>

// ─── Helpers ────────────────────────────────────────────────────────────────

static double clamp(double v, double lo, double hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

// Convert a Unix-seconds timestamp to a date string "YYYY-MM-DD" (UTC)
static std::string to_date(double ts) {
    time_t t = static_cast<time_t>(ts);
    struct tm* gmt = gmtime(&t);
    char buf[11];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02d",
             gmt->tm_year + 1900, gmt->tm_mon + 1, gmt->tm_mday);
    return std::string(buf);
}

// ─── Overtrading ─────────────────────────────────────────────────────────────

DetectorResult detect_overtrading(
    const std::vector<double>& timestamps,
    const std::vector<std::string>& sides,
    const std::vector<std::string>& symbols,
    const std::vector<double>& quantities,
    const std::vector<double>& pnl,
    int trades_per_day_threshold,
    int burst_window_minutes,
    int burst_threshold)
{
    int n = static_cast<int>(timestamps.size());
    DetectorResult result;

    if (n == 0) {
        result.score = 0.0;
        result.stats = {{"avg_trades_per_day", 0.0}, {"max_trades_per_day", 0.0},
                        {"max_burst_trades", 0.0}, {"position_switches", 0.0}};
        return result;
    }

    // Daily trade counts
    std::map<std::string, int> daily_counts;
    for (int i = 0; i < n; i++)
        daily_counts[to_date(timestamps[i])]++;

    double avg_trades_per_day = 0.0;
    int max_trades_per_day = 0;
    for (auto& kv : daily_counts) {
        avg_trades_per_day += kv.second;
        if (kv.second > max_trades_per_day)
            max_trades_per_day = kv.second;
    }
    avg_trades_per_day /= static_cast<double>(daily_counts.size());

    // High-activity dates
    std::set<std::string> high_day_dates;
    for (auto& kv : daily_counts)
        if (kv.second > trades_per_day_threshold)
            high_day_dates.insert(kv.first);

    // Burst detection: for each trade, count trades in the preceding window
    double burst_window_sec = burst_window_minutes * 60.0;
    std::vector<int> burst_counts(n, 0);
    int max_burst = 0;
    for (int i = 0; i < n; i++) {
        int cnt = 0;
        for (int j = i; j >= 0 && (timestamps[i] - timestamps[j]) <= burst_window_sec; j--)
            cnt++;
        burst_counts[i] = cnt;
        if (cnt > max_burst) max_burst = cnt;
    }

    // Position-switching: same symbol, direction flip within 5 min
    int position_switches = 0;
    std::set<int> switch_indices;

    // Group indices by symbol
    std::map<std::string, std::vector<int>> sym_to_indices;
    for (int i = 0; i < n; i++)
        sym_to_indices[symbols[i]].push_back(i);

    for (auto& kv : sym_to_indices) {
        auto& idxs = kv.second;
        // Sort by timestamp
        std::sort(idxs.begin(), idxs.end(),
                  [&](int a, int b){ return timestamps[a] < timestamps[b]; });
        for (int k = 1; k < static_cast<int>(idxs.size()); k++) {
            int prev = idxs[k-1], curr = idxs[k];
            if (sides[prev] != sides[curr]) {
                double gap_min = (timestamps[curr] - timestamps[prev]) / 60.0;
                if (gap_min <= 5.0) {
                    position_switches++;
                    switch_indices.insert(curr);
                }
            }
        }
    }

    // Build flag indices
    std::set<int> flagged;
    for (int i = 0; i < n; i++) {
        if (burst_counts[i] >= burst_threshold)
            flagged.insert(i);
        if (high_day_dates.count(to_date(timestamps[i])))
            flagged.insert(i);
    }
    for (int idx : switch_indices)
        flagged.insert(idx);

    for (int idx : flagged)
        result.flag_indices.push_back(idx);
    std::sort(result.flag_indices.begin(), result.flag_indices.end());

    // Score
    double day_component   = std::min(avg_trades_per_day / trades_per_day_threshold, 2.0);
    double burst_component = std::min(static_cast<double>(max_burst) / burst_threshold, 2.0);
    double switch_component = std::min(
        static_cast<double>(position_switches) / std::max(n * 0.05, 1.0), 2.0);
    double score = clamp((0.45 * day_component + 0.30 * burst_component + 0.25 * switch_component) * 50, 0, 100);

    result.score = score;
    result.stats = {
        {"avg_trades_per_day", avg_trades_per_day},
        {"max_trades_per_day", static_cast<double>(max_trades_per_day)},
        {"max_burst_trades",   static_cast<double>(max_burst)},
        {"position_switches",  static_cast<double>(position_switches)},
    };
    return result;
}

// ─── Loss Aversion ───────────────────────────────────────────────────────────

DetectorResult detect_loss_aversion(
    const std::vector<double>& timestamps,
    const std::vector<double>& pnl,
    const std::vector<double>& hold_minutes)
{
    int n = static_cast<int>(pnl.size());
    DetectorResult result;

    if (n == 0) {
        result.score = 0.0;
        result.stats = {{"loser_to_winner_hold_ratio", 0.0}, {"avg_loss_size", 0.0},
                        {"avg_win_size", 0.0}, {"loss_to_win_ratio", 0.0},
                        {"risk_reward_ratio", 0.0}, {"avg_loser_hold_minutes", 0.0},
                        {"avg_winner_hold_minutes", 0.0}};
        return result;
    }

    double win_hold_sum = 0.0, loss_hold_sum = 0.0;
    double win_size_sum = 0.0, loss_size_sum = 0.0;
    int win_count = 0, loss_count = 0;
    double avg_winner_hold = 0.0;

    for (int i = 0; i < n; i++) {
        double h = (i < static_cast<int>(hold_minutes.size())) ? hold_minutes[i] : 0.0;
        if (pnl[i] > 0) {
            win_hold_sum += h;
            win_size_sum += pnl[i];
            win_count++;
        } else {
            loss_hold_sum += h;
            loss_size_sum += std::abs(pnl[i]);
            loss_count++;
        }
    }

    double avg_win_hold  = win_count  > 0 ? win_hold_sum  / win_count  : 1.0;
    double avg_loss_hold = loss_count > 0 ? loss_hold_sum / loss_count : 1.0;
    double avg_win_size  = win_count  > 0 ? win_size_sum  / win_count  : 1.0;
    double avg_loss_size = loss_count > 0 ? loss_size_sum / loss_count : 0.0;

    double hold_ratio        = avg_loss_hold / std::max(avg_win_hold, 0.001);
    double loss_to_win_ratio = avg_loss_size / std::max(avg_win_size, 0.001);
    double risk_reward       = avg_win_size  / std::max(avg_loss_size, 0.001);

    // Flag trades: losers held > 1.5x avg winner hold, or loss > 2x avg win
    for (int i = 0; i < n; i++) {
        double h = (i < static_cast<int>(hold_minutes.size())) ? hold_minutes[i] : 0.0;
        if (pnl[i] < 0) {
            if (h > avg_win_hold * 1.5 || std::abs(pnl[i]) > avg_win_size * 2.0)
                result.flag_indices.push_back(i);
        }
    }

    double hold_component = clamp((hold_ratio - 1.0) * 60.0, 0.0, 100.0);
    double size_component = clamp((loss_to_win_ratio - 1.0) * 50.0, 0.0, 100.0);
    result.score = 0.5 * hold_component + 0.5 * size_component;

    result.stats = {
        {"loser_to_winner_hold_ratio", hold_ratio},
        {"avg_loser_hold_minutes",     avg_loss_hold},
        {"avg_winner_hold_minutes",    avg_win_hold},
        {"avg_loss_size",              avg_loss_size},
        {"avg_win_size",               avg_win_size},
        {"loss_to_win_ratio",          loss_to_win_ratio},
        {"risk_reward_ratio",          risk_reward},
    };
    return result;
}

// ─── Revenge Trading ─────────────────────────────────────────────────────────

DetectorResult detect_revenge_trading(
    const std::vector<double>& timestamps,
    const std::vector<double>& pnl,
    const std::vector<double>& quantities,
    int reentry_window_minutes,
    double size_multiplier_threshold,
    int streak_threshold)
{
    int n = static_cast<int>(pnl.size());
    DetectorResult result;

    if (n == 0) {
        result.score = 0.0;
        result.stats = {{"revenge_events", 0.0}, {"event_rate", 0.0}, {"streak_events", 0.0}};
        return result;
    }

    double window_sec = reentry_window_minutes * 60.0;
    std::set<int> flagged;
    int events = 0;

    // Single-loss rapid re-entry
    for (int i = 0; i < n; i++) {
        if (pnl[i] >= 0.0) continue;
        double time_boundary = timestamps[i] + window_sec;
        for (int j = i + 1; j < std::min(n, i + 6); j++) {
            if (timestamps[j] > time_boundary) break;
            if (quantities[j] >= quantities[i] * size_multiplier_threshold) {
                flagged.insert(j);
                events++;
                break;
            }
        }
    }

    // Streak-based detection
    int streak_events = 0;
    int loss_streak = 0;
    for (int i = 0; i < n; i++) {
        if (pnl[i] < 0.0) {
            loss_streak++;
        } else {
            if (loss_streak >= streak_threshold) {
                int streak_start = std::max(0, i - loss_streak);
                double streak_qty_sum = 0.0;
                int streak_len = i - streak_start;
                for (int k = streak_start; k < i; k++)
                    streak_qty_sum += quantities[k];
                double avg_streak_qty = streak_len > 0 ? streak_qty_sum / streak_len : 0.0;
                if (avg_streak_qty > 0.0 && quantities[i] >= avg_streak_qty * 1.1) {
                    streak_events++;
                    flagged.insert(i);
                }
            }
            loss_streak = 0;
        }
    }

    for (int idx : flagged)
        result.flag_indices.push_back(idx);
    std::sort(result.flag_indices.begin(), result.flag_indices.end());

    int total_events = events + streak_events;
    double event_rate = static_cast<double>(total_events) / std::max(n, 1);
    result.score = clamp(event_rate * 350.0, 0.0, 100.0);
    result.stats = {
        {"revenge_events", static_cast<double>(events)},
        {"streak_events",  static_cast<double>(streak_events)},
        {"event_rate",     event_rate},
    };
    return result;
}
