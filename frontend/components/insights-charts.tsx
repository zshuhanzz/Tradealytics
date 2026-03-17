"use client";

import { useMemo, useState } from "react";
import type { EvidenceItem } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area,
} from "recharts";

interface Props {
  trades: Record<string, any>[];
  featureStats: Record<string, any>;
  biasEvidence: Record<string, EvidenceItem[]>;
}

interface BucketRow {
  label: string;
  trades: number;
  pnl: number;
  cumPnl: number;
}

type HeatmapMetric = "count" | "pnl" | "avgPnl";
type HeatmapTimeRes = "1h" | "2h" | "4h" | "session";
type HeatmapRowMode = "weekday" | "date";
type Granularity = "1m" | "5m" | "15m" | "1h" | "1d";

const SESSIONS = [
  { label: "Pre",   start: 4,  end: 9  },
  { label: "Open",  start: 9,  end: 12 },
  { label: "Mid",   start: 12, end: 14 },
  { label: "Close", start: 14, end: 16 },
  { label: "After", start: 16, end: 20 },
  { label: "Night", start: 20, end: 4  },
];

const GRAN_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "1m",  label: "1 Min"  },
  { value: "5m",  label: "5 Min"  },
  { value: "15m", label: "15 Min" },
  { value: "1h",  label: "1 Hour" },
  { value: "1d",  label: "1 Day"  },
];

const HEAT_METRIC_OPTIONS: { value: HeatmapMetric; label: string }[] = [
  { value: "count",  label: "Trades"  },
  { value: "pnl",    label: "PnL"     },
  { value: "avgPnl", label: "Avg PnL" },
];

const HEAT_TIME_OPTIONS: { value: HeatmapTimeRes; label: string }[] = [
  { value: "1h",      label: "1 Hour"   },
  { value: "2h",      label: "2 Hour"   },
  { value: "4h",      label: "4 Hour"   },
  { value: "session", label: "Session"  },
];

const HEAT_ROW_OPTIONS: { value: HeatmapRowMode; label: string }[] = [
  { value: "weekday", label: "Weekday" },
  { value: "date",    label: "By Date" },
];

function getBucketKey(timestamp: string, granularity: Granularity): string {
  const ts = String(timestamp ?? "");
  if (granularity === "1d") return ts.slice(0, 10) || "unknown";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(0, 10) || "unknown";
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const h = d.getHours(), m = d.getMinutes();
  switch (granularity) {
    case "1m":  return `${dateStr} ${pad(h)}:${pad(m)}`;
    case "5m":  return `${dateStr} ${pad(h)}:${pad(Math.floor(m / 5) * 5)}`;
    case "15m": return `${dateStr} ${pad(h)}:${pad(Math.floor(m / 15) * 15)}`;
    case "1h":  return `${dateStr} ${pad(h)}:00`;
    default:    return dateStr;
  }
}

function formatBucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "1d") return key;
  const parts = key.split(" ");
  return parts.length > 1 ? parts[1] : key;
}

function autoDetectGranularity(trades: Record<string, any>[]): Granularity {
  if (trades.length < 2) return "1d";
  const timestamps = trades
    .map(t => new Date(String(t.timestamp ?? "")))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (timestamps.length < 2) return "1d";
  const spanHours = (timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()) / 3600000;
  if (spanHours <= 2) return "1m";
  if (spanHours <= 8) return "5m";
  if (spanHours <= 24) return "15m";
  if (spanHours <= 168) return "1h";
  return "1d";
}

// Segmented button group helper
function SegmentGroup<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--muted)",
      borderRadius: 7, padding: 3, gap: 2 }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{ padding: "4px 10px", borderRadius: 5, border: "none",
            fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.12s",
            background: value === opt.value ? "var(--card)" : "transparent",
            color: value === opt.value ? "var(--foreground)" : "var(--muted-foreground)" }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: 8, fontSize: 12, border: "1px solid #1A3A52",
  background: "#0C2438", color: "#F0EAF0",
};

const chartCardStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "12px 14px",
};

export default function InsightsCharts({ trades, featureStats, biasEvidence }: Props) {
  const defaultGranularity = useMemo(() => autoDetectGranularity(trades), [trades]);
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);
  const [heatMetric, setHeatMetric] = useState<HeatmapMetric>("count");
  const [heatTimeRes, setHeatTimeRes] = useState<HeatmapTimeRes>("1h");
  const [heatRowMode, setHeatRowMode] = useState<HeatmapRowMode>("weekday");

  const bucketData: BucketRow[] = useMemo(() => {
    const byBucket: Record<string, { count: number; pnl: number; sizeSum: number }> = {};
    for (const t of trades) {
      const key = getBucketKey(String(t.timestamp ?? ""), granularity);
      if (!byBucket[key]) byBucket[key] = { count: 0, pnl: 0, sizeSum: 0 };
      byBucket[key].count += 1;
      byBucket[key].pnl += Number(t.pnl ?? 0);
      byBucket[key].sizeSum += Number(t.quantity ?? 0) * Number(t.price ?? 0);
    }
    let cumPnl = 0;
    return Object.entries(byBucket).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => {
      cumPnl += v.pnl;
      return {
        label: formatBucketLabel(key, granularity),
        trades: v.count,
        pnl: parseFloat(v.pnl.toFixed(2)),
        cumPnl: parseFloat(cumPnl.toFixed(2)),
      };
    });
  }, [trades, granularity]);

  const granularityLabel = GRAN_OPTIONS.find(o => o.value === granularity)?.label || granularity;

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const heatColumns = useMemo(() => {
    if (heatTimeRes === "session") return SESSIONS.map(s => ({ key: s.label, label: s.label }));
    const step = heatTimeRes === "1h" ? 1 : heatTimeRes === "2h" ? 2 : 4;
    const cols: { key: string; label: string }[] = [];
    for (let h = 0; h < 24; h += step) {
      const end = Math.min(h + step, 24);
      cols.push({
        key: `${h}`,
        label: step === 1
          ? h.toString().padStart(2, "0")
          : `${h.toString().padStart(2, "0")}-${end.toString().padStart(2, "0")}`,
      });
    }
    return cols;
  }, [heatTimeRes]);

  const heatRows = useMemo(() => {
    if (heatRowMode === "weekday") return DAY_LABELS.map((label, i) => ({ key: String(i), label }));
    const dates = new Set<string>();
    for (const t of trades) {
      const d = new Date(String(t.timestamp ?? ""));
      if (!isNaN(d.getTime())) dates.add(d.toISOString().slice(0, 10));
    }
    return [...dates].sort().map(d => ({ key: d, label: d }));
  }, [heatRowMode, trades]);

  const heatGrid = useMemo(() => {
    const grid: Record<string, { count: number; pnl: number }> = {};
    for (const t of trades) {
      const d = new Date(String(t.timestamp ?? ""));
      if (isNaN(d.getTime())) continue;
      const rowKey = heatRowMode === "weekday" ? String(d.getDay()) : d.toISOString().slice(0, 10);
      let colKey: string;
      if (heatTimeRes === "session") {
        const h = d.getHours();
        const sess = SESSIONS.find(s =>
          s.start < s.end ? h >= s.start && h < s.end : h >= s.start || h < s.end
        );
        colKey = sess ? sess.label : SESSIONS[SESSIONS.length - 1].label;
      } else {
        const step = heatTimeRes === "1h" ? 1 : heatTimeRes === "2h" ? 2 : 4;
        colKey = `${Math.floor(d.getHours() / step) * step}`;
      }
      const k = `${rowKey}|${colKey}`;
      if (!grid[k]) grid[k] = { count: 0, pnl: 0 };
      grid[k].count += 1;
      grid[k].pnl += Number(t.pnl ?? 0);
    }
    return grid;
  }, [trades, heatRowMode, heatTimeRes]);

  const heatRange = useMemo(() => {
    const vals = Object.values(heatGrid).map(v =>
      heatMetric === "count" ? v.count : heatMetric === "pnl" ? v.pnl : v.count > 0 ? v.pnl / v.count : 0
    );
    if (vals.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(0, ...vals), max: Math.max(1, ...vals) };
  }, [heatGrid, heatMetric]);

  function getCellData(rowKey: string, colKey: string) {
    const cell = heatGrid[`${rowKey}|${colKey}`];
    if (!cell) return { value: 0, count: 0, pnl: 0 };
    const value = heatMetric === "count" ? cell.count
      : heatMetric === "pnl" ? cell.pnl
      : cell.count > 0 ? cell.pnl / cell.count : 0;
    return { value, count: cell.count, pnl: cell.pnl };
  }

  function heatBg(value: number): string {
    if (heatMetric === "count") {
      if (value === 0) return "transparent";
      const t = value / heatRange.max;
      if (t < 0.25) return "rgba(163, 68, 93, 0.2)";
      if (t < 0.5)  return "rgba(163, 68, 93, 0.4)";
      if (t < 0.75) return "rgba(163, 68, 93, 0.65)";
      return "#A3445D";
    }
    if (value === 0) return "transparent";
    if (value > 0) {
      const t = Math.min(value / Math.max(heatRange.max, 1), 1);
      if (t < 0.33) return "rgba(58, 168, 90, 0.2)";
      if (t < 0.66) return "rgba(58, 168, 90, 0.5)";
      return "#3AA85A";
    }
    const t = Math.min(Math.abs(value) / Math.max(Math.abs(heatRange.min), 1), 1);
    if (t < 0.33) return "rgba(192, 57, 43, 0.2)";
    if (t < 0.66) return "rgba(192, 57, 43, 0.5)";
    return "#C0392B";
  }

  const xAxisProps = {
    tick: { fontSize: 10, fill: "var(--muted-foreground)" },
    angle: bucketData.length > 12 ? -45 : 0,
    textAnchor: (bucketData.length > 12 ? "end" : "middle") as "end" | "middle",
    height: bucketData.length > 12 ? 50 : 30,
    interval: bucketData.length > 20 ? Math.floor(bucketData.length / 10) : 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Granularity selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Time Window:</span>
        <SegmentGroup options={GRAN_OPTIONS} value={granularity} onChange={setGranularity} />
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: "auto" }}>
          {bucketData.length} intervals
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Trade Frequency */}
        <div style={chartCardStyle}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
            Trade Frequency
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bucketData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1A3A52" opacity={0.6} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={35} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="trades" fill="#A3445D" name="Trades" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative PnL */}
        <div style={chartCardStyle}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
            Cumulative PnL
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bucketData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3AA85A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3AA85A" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A3A52" opacity={0.6} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={45} tickFormatter={v => `$${v}`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}`, "Cum. PnL"]}
                contentStyle={TOOLTIP_STYLE} labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="cumPnl" stroke="#3AA85A" strokeWidth={2}
                fill="url(#pnlGrad)" name="Cum. PnL" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* PnL per period */}
        <div style={chartCardStyle}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
            PnL per {granularityLabel}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bucketData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1A3A52" opacity={0.6} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={45} tickFormatter={v => `$${v}`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}`, "PnL"]}
                contentStyle={TOOLTIP_STYLE} labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="pnl" name="PnL" radius={[3, 3, 0, 0]}>
                {bucketData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "#3AA85A" : "#C0392B"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Key Evidence */}
        <div style={chartCardStyle}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
            Key Evidence
          </p>
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(biasEvidence).map(([bias, items]) => (
              <div key={bias}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)",
                  textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                  {bias.replace(/_/g, " ")}
                </p>
                {items.map((ev, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 0", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{ev.metric}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>
                      {typeof ev.value === "number" ? ev.value.toFixed(2) : ev.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Trading Activity Heatmap — full width */}
        <div style={{ ...chartCardStyle, gridColumn: "span 2" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
            Trading Activity Heatmap
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase",
                letterSpacing: "0.05em" }}>Density:</span>
              <SegmentGroup options={HEAT_METRIC_OPTIONS} value={heatMetric} onChange={setHeatMetric} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase",
                letterSpacing: "0.05em" }}>Columns:</span>
              <SegmentGroup options={HEAT_TIME_OPTIONS} value={heatTimeRes} onChange={setHeatTimeRes} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase",
                letterSpacing: "0.05em" }}>Rows:</span>
              <SegmentGroup options={HEAT_ROW_OPTIONS} value={heatRowMode} onChange={setHeatRowMode} />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 500 }}>
              {/* Column headers */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <div style={{ width: 72, flexShrink: 0 }} />
                {heatColumns.map(col => (
                  <div key={col.key} style={{ flex: 1, textAlign: "center", fontSize: 9,
                    color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                    {col.label}
                  </div>
                ))}
              </div>
              {/* Rows */}
              <div style={heatRowMode === "date" && heatRows.length > 14 ? { maxHeight: 300, overflowY: "auto" } : {}}>
                {heatRows.map(row => (
                  <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
                    <div style={{ width: 72, flexShrink: 0, fontSize: 10, color: "var(--muted-foreground)",
                      textAlign: "right", paddingRight: 6, fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.label}
                    </div>
                    {heatColumns.map(col => {
                      const { value, count, pnl } = getCellData(row.key, col.key);
                      const displayVal = heatMetric === "count"
                        ? (count > 0 ? String(count) : "")
                        : (value !== 0 ? `$${Math.abs(value) < 10 ? value.toFixed(1) : Math.round(value)}` : "");
                      return (
                        <div key={col.key}
                          style={{ flex: 1, aspectRatio: "1", borderRadius: 3,
                            background: heatBg(value), display: "flex", alignItems: "center",
                            justifyContent: "center", cursor: "default", transition: "background 0.15s" }}
                          title={`${row.label} ${col.label} — ${count} trade${count !== 1 ? "s" : ""}, PnL: $${pnl.toFixed(2)}`}>
                          {displayVal && (
                            <span style={{ fontSize: 7, fontFamily: "monospace", fontWeight: 600,
                              color: "#fff", lineHeight: 1 }}>
                              {displayVal}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
                {heatMetric === "count" ? (
                  <>
                    <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>Less</span>
                    {["rgba(163,68,93,0.2)", "rgba(163,68,93,0.4)", "rgba(163,68,93,0.65)", "#A3445D"].map((bg, i) => (
                      <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: bg }} />
                    ))}
                    <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>More</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 9, color: "#C0392B" }}>Loss</span>
                    {["#C0392B", "rgba(192,57,43,0.5)", "rgba(192,57,43,0.2)", "transparent",
                      "rgba(58,168,90,0.2)", "rgba(58,168,90,0.5)", "#3AA85A"].map((bg, i) => (
                      <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: bg,
                        border: bg === "transparent" ? "1px solid var(--border)" : "none" }} />
                    ))}
                    <span style={{ fontSize: 9, color: "#3AA85A" }}>Profit</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
