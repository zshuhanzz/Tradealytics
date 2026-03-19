"use client";

import { useState, useMemo } from "react";
import type { BiasFlag } from "@/types";

interface Props {
  trades: Record<string, any>[];
  flaggedTrades: BiasFlag[];
}

const COLUMNS = [
  { key: "timestamp", label: "Time" },
  { key: "side",      label: "Side" },
  { key: "symbol",    label: "Symbol" },
  { key: "quantity",  label: "Qty" },
  { key: "price",     label: "Price" },
  { key: "pnl",       label: "PnL" },
];

export default function TradeTable({ trades, flaggedTrades }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");

  const flagMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const f of flaggedTrades) map[f.trade_index] = f.tags;
    return map;
  }, [flaggedTrades]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const rows = useMemo(() => {
    let result = trades.map((t, i) => ({ ...t, _idx: i } as Record<string, any>));
    if (filter) {
      const f = filter.toLowerCase();
      result = result.filter(r =>
        Object.entries(r).some(([k, v]) => k !== "_idx" && String(v).toLowerCase().includes(f))
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [trades, filter, sortKey, sortDir]);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>Trade Log</span>
        <input
          placeholder="Search trades…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ background: "var(--input-bg)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "var(--foreground)",
            outline: "none", width: 180 }}
        />
      </div>
      <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--muted)", zIndex: 1 }}>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)}
                  style={{ padding: "8px 14px", textAlign: "left", fontSize: 11,
                    fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase",
                    letterSpacing: "0.05em", cursor: "pointer", userSelect: "none",
                    whiteSpace: "nowrap" }}>
                  {col.label}
                  {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11,
                fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase",
                letterSpacing: "0.05em" }}>
                Biases
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tags = flagMap[row._idx];
              const hasBias = !!tags && tags.length > 0;
              return (
                <tr key={row._idx} style={{
                  borderTop: "1px solid var(--border)",
                  background: hasBias ? "rgba(192, 57, 43, 0.06)" : "transparent",
                }}>
                  <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11,
                    color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {typeof row.timestamp === "string" ? row.timestamp : String(row.timestamp)}
                  </td>
                  <td style={{ padding: "7px 14px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      background: String(row.side).toLowerCase() === "buy"
                        ? "rgba(58, 168, 90, 0.15)"
                        : "rgba(192, 57, 43, 0.15)",
                      color: String(row.side).toLowerCase() === "buy"
                        ? "var(--success)"
                        : "var(--danger)",
                    }}>
                      {row.side}
                    </span>
                  </td>
                  <td style={{ padding: "7px 14px", fontWeight: 600, fontSize: 12 }}>{row.symbol}</td>
                  <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11 }}>
                    {Number(row.quantity).toLocaleString()}
                  </td>
                  <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11 }}>
                    ${Number(row.price).toFixed(2)}
                  </td>
                  <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 11,
                    fontWeight: 600,
                    color: Number(row.pnl) >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {Number(row.pnl) >= 0 ? "+" : ""}${Number(row.pnl).toFixed(2)}
                  </td>
                  <td style={{ padding: "7px 14px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(tags || ["calm"]).map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 500,
                          background: tag === "calm"
                            ? "rgba(58, 168, 90, 0.15)"
                            : "rgba(192, 57, 43, 0.15)",
                          color: tag === "calm" ? "var(--success)" : "var(--danger)",
                        }}>
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
          {rows.length} of {trades.length} trades · {flaggedTrades.length} flagged
        </p>
      </div>
    </div>
  );
}
