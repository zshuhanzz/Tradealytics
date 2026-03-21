#include "tradealytics.h"

#include <algorithm>
#include <cmath>
#include <numeric>

// Returns 16 behavioral features from a window of trades.
// Feature order matches FEATURE_NAMES in backend/ml/features.py.
std::vector<double> extract_features(
    const std::vector<double>& timestamps,
    const std::vector<double>& pnl,
    const std::vector<double>& quantities,
    const std::vector<std::string>& sides,
    const std::vector<double>& prices,
    const std::vector<double>& balance)
{
    int n = static_cast<int>(timestamps.size());
    std::vector<double> feat(16, 0.0);

    if (n < 2) return feat;

    // ── Time features ────────────────────────────────────────────────────────
    double total_seconds = timestamps[n-1] - timestamps[0];
    double total_hours   = std::max(total_seconds / 3600.0, 0.001);
    feat[0] = n / total_hours;  // trades_per_hour

    std::vector<double> deltas(n - 1);
    for (int i = 0; i < n - 1; i++)
        deltas[i] = timestamps[i+1] - timestamps[i];

    double delta_sum = std::accumulate(deltas.begin(), deltas.end(), 0.0);
    double mean_delta = delta_sum / deltas.size();
    feat[1] = mean_delta;  // mean_time_between_trades_sec

    double var = 0.0;
    for (double d : deltas) var += (d - mean_delta) * (d - mean_delta);
    feat[2] = std::sqrt(var / deltas.size());  // std_time_between_trades_sec

    int burst_count = 0;
    for (double d : deltas)
        if (d <= 60.0) burst_count++;
    feat[3] = static_cast<double>(burst_count);  // burst_count_60s

    // ── PnL features ─────────────────────────────────────────────────────────
    double pnl_sum = std::accumulate(pnl.begin(), pnl.end(), 0.0);
    double pnl_mean = pnl_sum / n;
    feat[4] = pnl_mean;

    double pnl_var = 0.0;
    for (double p : pnl) pnl_var += (p - pnl_mean) * (p - pnl_mean);
    feat[5] = std::sqrt(pnl_var / n);  // pnl_std

    int wins = 0;
    for (double p : pnl) if (p > 0) wins++;
    feat[6] = static_cast<double>(wins) / n;  // win_rate

    // ── Size features ────────────────────────────────────────────────────────
    double qty_sum = std::accumulate(quantities.begin(), quantities.end(), 0.0);
    double avg_qty = qty_sum / n;
    feat[7] = avg_qty;

    double qty_var = 0.0;
    for (double q : quantities) qty_var += (q - avg_qty) * (q - avg_qty);
    feat[8] = std::sqrt(qty_var / n);  // std_quantity

    double tv_sum = 0.0;
    for (int i = 0; i < n; i++)
        tv_sum += quantities[i] * (i < static_cast<int>(prices.size()) ? prices[i] : 1.0);
    feat[9] = tv_sum / n;  // avg_trade_value

    // ── Loss aversion: hold-time proxy ───────────────────────────────────────
    // Use inter-trade delta as hold proxy for each trade
    double win_hold_sum = 0.0, loss_hold_sum = 0.0;
    int win_count = 0, loss_count = 0;
    // median delta as fallback for last trade
    std::vector<double> sorted_deltas = deltas;
    std::sort(sorted_deltas.begin(), sorted_deltas.end());
    double median_delta = sorted_deltas[sorted_deltas.size() / 2];

    for (int i = 0; i < n; i++) {
        double hold = (i < n - 1) ? deltas[i] : median_delta;
        if (pnl[i] > 0) { win_hold_sum += hold; win_count++; }
        else             { loss_hold_sum += hold; loss_count++; }
    }
    double avg_win_hold  = win_count  > 0 ? win_hold_sum  / win_count  : 1.0;
    double avg_loss_hold = loss_count > 0 ? loss_hold_sum / loss_count : 1.0;
    feat[10] = avg_loss_hold / std::max(avg_win_hold, 0.001);  // loss_hold_to_win_hold_ratio

    // ── Revenge trading features ─────────────────────────────────────────────
    std::vector<double> sizes_after_loss;
    std::vector<double> reentry_times_after_loss;
    for (int i = 1; i < n; i++) {
        if (pnl[i-1] < 0.0) {
            sizes_after_loss.push_back(quantities[i] / std::max(quantities[i-1], 0.001));
            if (i - 1 < static_cast<int>(deltas.size()))
                reentry_times_after_loss.push_back(deltas[i-1]);
        }
    }

    if (!sizes_after_loss.empty()) {
        double s = std::accumulate(sizes_after_loss.begin(), sizes_after_loss.end(), 0.0);
        feat[11] = s / sizes_after_loss.size();
    } else {
        feat[11] = 1.0;
    }

    if (!reentry_times_after_loss.empty()) {
        double s = std::accumulate(reentry_times_after_loss.begin(), reentry_times_after_loss.end(), 0.0);
        feat[12] = s / reentry_times_after_loss.size();
    } else {
        feat[12] = 300.0;
    }

    // Max consecutive loss streak
    int max_streak = 0, cur_streak = 0;
    for (double p : pnl) {
        if (p <= 0.0) { cur_streak++; max_streak = std::max(max_streak, cur_streak); }
        else cur_streak = 0;
    }
    feat[13] = static_cast<double>(max_streak);

    // ── Diversity features ───────────────────────────────────────────────────
    int side_changes = 0;
    for (int i = 1; i < n; i++) {
        std::string prev = sides[i-1], curr = sides[i];
        // lowercase compare
        std::transform(prev.begin(), prev.end(), prev.begin(), ::tolower);
        std::transform(curr.begin(), curr.end(), curr.begin(), ::tolower);
        if (prev != curr) side_changes++;
    }
    feat[14] = static_cast<double>(side_changes) / std::max(n - 1, 1);  // side_switch_rate

    // ── Balance drawdown ────────────────────────────────────────────────────
    if (!balance.empty() && static_cast<int>(balance.size()) == n) {
        double running_max = balance[0];
        double max_dd = 0.0;
        for (double b : balance) {
            if (b > running_max) running_max = b;
            double dd = running_max > 0 ? (running_max - b) / running_max : 0.0;
            if (dd > max_dd) max_dd = dd;
        }
        feat[15] = max_dd * 100.0;
    } else {
        feat[15] = 0.0;
    }

    return feat;
}
