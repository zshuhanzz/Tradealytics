"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getSessions } from "@/lib/api";
import type { User } from "@/types";

interface SessionRecord {
  id: number;
  user_id: number | null;
  created_at: string;
  analysis_mode: string;
  trade_count: number;
  overtrading_score: number;
  loss_aversion_score: number;
  revenge_score: number;
  calm_score: number;
}

interface ChartPoint {
  date: string;
  Overtrading: number;
  "Loss Aversion": number;
  "Revenge Trading": number;
  Calm: number;
  trade_count: number;
  session_id: number;
}

interface Props {
  currentUser: User | null;
}

const BIAS_LINES = [
  { key: "Overtrading",     color: "#ef4444" },
  { key: "Loss Aversion",   color: "#f97316" },
  { key: "Revenge Trading", color: "#eab308" },
  { key: "Calm",            color: "#22c55e" },
] as const;

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const trade_count = payload[0]?.payload?.trade_count;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <strong>{p.value.toFixed(1)}</strong>
        </p>
      ))}
      {trade_count !== undefined && (
        <p style={{ color: "var(--muted-foreground)", marginTop: 6, fontSize: 12 }}>
          {trade_count} trades
        </p>
      )}
    </div>
  );
}

export default function ProgressTab({ currentUser }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getSessions(currentUser.id)
      .then((res) => res.json())
      .then((data) => setSessions(data))
      .catch(() => setError("Failed to load session history"))
      .finally(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 300, color: "var(--muted-foreground)", fontSize: 14, textAlign: "center" }}>
        <div>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📈</p>
          <p style={{ fontWeight: 600, marginBottom: 6, color: "var(--foreground)" }}>
            Track your progress over time
          </p>
          <p>Log in with a username on the home screen to save sessions and see your bias trends.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 300, color: "var(--muted-foreground)", fontSize: 14 }}>
        Loading session history…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 300, color: "var(--danger)", fontSize: 14 }}>
        {error}
      </div>
    );
  }

  if (sessions.length < 2) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 300, color: "var(--muted-foreground)", fontSize: 14, textAlign: "center" }}>
        <div>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📊</p>
          <p style={{ fontWeight: 600, marginBottom: 6, color: "var(--foreground)" }}>
            {sessions.length === 0
              ? "No sessions saved yet"
              : "Only 1 session so far"}
          </p>
          <p>Analyze more trading sessions to see your bias trends over time.</p>
        </div>
      </div>
    );
  }

  const chartData: ChartPoint[] = sessions.map((s) => ({
    date: formatDate(s.created_at),
    Overtrading: s.overtrading_score,
    "Loss Aversion": s.loss_aversion_score,
    "Revenge Trading": s.revenge_score,
    Calm: s.calm_score,
    trade_count: s.trade_count,
    session_id: s.id,
  }));

  // Latest session deltas vs first session
  const first = sessions[0];
  const latest = sessions[sessions.length - 1];
  const deltas = [
    { label: "Overtrading",     delta: latest.overtrading_score - first.overtrading_score,    better: false },
    { label: "Loss Aversion",   delta: latest.loss_aversion_score - first.loss_aversion_score, better: false },
    { label: "Revenge Trading", delta: latest.revenge_score - first.revenge_score,             better: false },
    { label: "Calm",            delta: latest.calm_score - first.calm_score,                   better: true  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          Bias Trends — {currentUser.username}
        </h2>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
          {sessions.length} sessions · {formatDate(first.created_at)} → {formatDate(sessions[sessions.length - 1].created_at)}
        </p>
      </div>

      {/* Delta summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {deltas.map(({ label, delta, better }) => {
          const improved = better ? delta > 0 : delta < 0;
          const color = delta === 0
            ? "var(--muted-foreground)"
            : improved ? "var(--success)" : "var(--danger)";
          return (
            <div key={label} style={{ background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 17, fontWeight: 700, color }}>
                {delta === 0 ? "–" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
              </p>
              <p style={{ fontSize: 11, color }}>
                {delta === 0 ? "no change" : improved ? "improved" : "worsened"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Line chart */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "20px 10px 10px" }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false} tickLine={false} width={32} />
            <ReferenceLine y={70} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity={0.4} />
            <ReferenceLine y={40} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.3} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            {BIAS_LINES.map(({ key, color }) => (
              <Line key={key} type="monotone" dataKey={key} stroke={color}
                strokeWidth={2} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 8 }}>
          Dashed lines at 40 (medium) and 70 (high severity)
        </p>
      </div>
    </div>
  );
}
