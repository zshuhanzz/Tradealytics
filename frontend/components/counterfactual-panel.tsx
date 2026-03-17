"use client";

import { useState } from "react";
import type { CounterfactualRules, CounterfactualResponse } from "@/types";
import { fetchCounterfactual } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";

interface Props {
  trades: Record<string, any>[];
  onResult?: (result: CounterfactualResponse) => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 6,
  padding: "7px 10px", width: "100%", fontSize: 13, color: "var(--foreground)", outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4,
};

function StatusBadge({ status }: { status: string }) {
  const style: React.CSSProperties =
    status === "kept"     ? { background: "rgba(58, 168, 90, 0.15)",  color: "var(--success)" } :
    status === "removed"  ? { background: "rgba(192, 57, 43, 0.15)", color: "var(--danger)" } :
                            { background: "rgba(249, 115, 22, 0.15)", color: "#F97316" };
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, ...style }}>
      {status}
    </span>
  );
}

export default function CounterfactualPanel({ trades, onResult }: Props) {
  const [rules, setRules] = useState<CounterfactualRules>({
    cooldown_minutes_after_loss: 30,
    max_trades_per_day: 20,
    cap_size_after_loss: 1.0,
  });
  const [result, setResult] = useState<CounterfactualResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetchCounterfactual(trades, rules);
      if (res.ok) {
        const data: CounterfactualResponse = await res.json();
        setResult(data);
        onResult?.(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? [
        { name: "Original",       pnl: result.original_pnl },
        { name: "Counterfactual", pnl: result.counterfactual_pnl },
      ]
    : [];

  const cardStyle: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={cardStyle}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 14px" }}>
          Behavioral Rules
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 14px", marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Cooldown after loss (min)</label>
            <input type="number" value={rules.cooldown_minutes_after_loss} style={inputStyle}
              onChange={e => setRules(r => ({ ...r, cooldown_minutes_after_loss: +e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Max trades/day</label>
            <input type="number" value={rules.max_trades_per_day} style={inputStyle}
              onChange={e => setRules(r => ({ ...r, max_trades_per_day: +e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Cap size after loss (multiplier)</label>
            <input type="number" step="0.1" value={rules.cap_size_after_loss} style={inputStyle}
              onChange={e => setRules(r => ({ ...r, cap_size_after_loss: +e.target.value }))} />
          </div>
        </div>
        <button onClick={run} disabled={loading}
          style={{ width: "100%", padding: "10px 0", borderRadius: 6, border: "none",
            background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Simulating…" : "Run Counterfactual Simulation"}
        </button>
      </div>

      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          className="animate-fade-in">
          {/* Summary */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
              Results Summary
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Original PnL",       value: formatCurrency(result.original_pnl),       color: "var(--foreground)" },
                { label: "Counterfactual PnL",  value: formatCurrency(result.counterfactual_pnl), color: "var(--success)" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{row.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: row.color }}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Delta</span>
                <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                  color: result.pnl_delta >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {result.pnl_delta >= 0 ? "+" : ""}{formatCurrency(result.pnl_delta)}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 4 }}>
                {[
                  { count: result.kept_trades,     label: "Kept",     color: "var(--success)" },
                  { count: result.removed_trades,  label: "Removed",  color: "var(--danger)" },
                  { count: result.modified_trades, label: "Modified", color: "#F97316" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center", padding: "8px 6px",
                    background: "var(--muted)", borderRadius: 6 }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: item.color, margin: 0 }}>{item.count}</p>
                    <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
              PnL Comparison
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1A3A52" opacity={0.6} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={50}
                  tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "PnL"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #1A3A52",
                    background: "var(--card)", color: "var(--foreground)" }}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#C0392B" : "#3AA85A"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {result.modified_trade_list.length > 0 && (
            <div style={{ ...cardStyle, gridColumn: "span 2", padding: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)",
                margin: 0, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                Trade Details
              </p>
              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--muted)" }}>
                    <tr>
                      {["#", "Symbol", "Side", "PnL", "Status", "Reason"].map(h => (
                        <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11,
                          fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase",
                          letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.modified_trade_list.map(t => (
                      <tr key={t.trade_index} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11 }}>{t.trade_index}</td>
                        <td style={{ padding: "7px 14px", fontWeight: 600, fontSize: 12 }}>{t.symbol}</td>
                        <td style={{ padding: "7px 14px", fontSize: 12 }}>{t.side}</td>
                        <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11, fontWeight: 600,
                          color: t.pnl >= 0 ? "var(--success)" : "var(--danger)" }}>
                          ${t.pnl.toFixed(2)}
                        </td>
                        <td style={{ padding: "7px 14px" }}><StatusBadge status={t.status} /></td>
                        <td style={{ padding: "7px 14px", fontSize: 11, color: "var(--muted-foreground)",
                          maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
