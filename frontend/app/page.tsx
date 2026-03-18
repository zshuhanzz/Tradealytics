"use client";

import { useState, useMemo } from "react";
import type { AnalyzeResponse, ColumnMapping, CounterfactualResponse } from "@/types";
import { analyzeCSV, type AnalysisMode } from "@/lib/api";
import CSVUpload from "@/components/csv-upload";
import BiasScoreCards from "@/components/bias-scorecards";
import TradeTable from "@/components/trade-table";
import InsightsCharts from "@/components/insights-charts";
import CounterfactualPanel from "@/components/counterfactual-panel";
import CoachingTab from "@/components/coaching-tab";
import ChatPanel from "@/components/chat-panel";
import { formatCurrency } from "@/lib/utils";

// ── Icons ─────────────────────────────────────────────────────────────────────
function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  insights:    "M3 3v18h18M7 16l4-4 4 4 4-4",
  timeline:    "M3 12h18M3 6h18M3 18h18",
  whatif:      "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  coaching:    "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  chat:        "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  sun:         "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon:        "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  reset:       "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5",
};

type Section = "insights" | "timeline" | "whatif" | "coaching" | "chat";

const NAV_ITEMS: { id: Section; label: string; iconKey: keyof typeof ICONS }[] = [
  { id: "insights",  label: "Insights",  iconKey: "insights" },
  { id: "timeline",  label: "Timeline",  iconKey: "timeline" },
  { id: "whatif",    label: "What-If",   iconKey: "whatif" },
  { id: "coaching",  label: "Coaching",  iconKey: "coaching" },
  { id: "chat",      label: "Chat",      iconKey: "chat" },
];

// ── Theme toggle (inlined) ────────────────────────────────────────────────────
function ThemeToggle() {
  const [dark, setDark] = useState(true);
  const toggle = () => {
    const html = document.documentElement;
    if (dark) {
      html.classList.remove("dark");
      html.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      html.classList.remove("light");
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setDark(!dark);
  };
  return (
    <button onClick={toggle} style={{ color: "var(--muted-foreground)", background: "none",
      border: "1px solid var(--border)", borderRadius: 10, padding: "11px 16px", cursor: "pointer",
      display: "flex", alignItems: "center" }}>
      <Icon path={dark ? ICONS.sun : ICONS.moon} size={26} />
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: color || "var(--foreground)" }}>{value}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counterfactual, setCounterfactual] = useState<CounterfactualResponse | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("mixed");
  const [activeSection, setActiveSection] = useState<Section>("insights");

  const handleUpload = async (file: File, mapping?: ColumnMapping) => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeCSV(file, mapping as any, analysisMode);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || "Analysis failed");
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const trades = data.normalized_trades;
    const totalPnl = trades.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
    const wins = trades.filter((t) => Number(t.pnl ?? 0) > 0).length;
    const winRate = trades.length > 0 ? wins / trades.length : 0;
    const avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;
    const maxWin = Math.max(...trades.map((t) => Number(t.pnl ?? 0)));
    const maxLoss = Math.min(...trades.map((t) => Number(t.pnl ?? 0)));
    return { totalPnl, wins, winRate, avgPnl, maxWin, maxLoss };
  }, [data]);

  // ── Upload / loading screen ─────────────────────────────────────────────────
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--background)", position: "relative" }}>
        {/* Theme toggle — top right */}
        <div style={{ position: "absolute", top: 28, right: 80 }}>
          <ThemeToggle />
        </div>
        <div style={{ width: "100%", maxWidth: 640, padding: "0 32px" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18,
              background: "var(--primary)", display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 20px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
              <span style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>T</span>
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 700, margin: "0 0 10px",
              color: "var(--foreground)" }}>Tradealytics</h1>
            <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
              Upload your trade log to detect behavioral biases and get AI coaching.
            </p>
          </div>

          {/* Analysis mode */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10,
              textTransform: "uppercase", letterSpacing: "0.08em" }}>Analysis Method</p>
            <div style={{ display: "flex", gap: 6, background: "var(--muted)",
              borderRadius: 10, padding: 5 }}>
              {(["rules_only", "mixed", "ml_only"] as const).map((m) => (
                <button key={m} onClick={() => setAnalysisMode(m)}
                  style={{ flex: 1, padding: "14px 4px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 15, fontWeight: 500,
                    background: analysisMode === m ? "var(--card)" : "transparent",
                    color: analysisMode === m ? "var(--foreground)" : "var(--muted-foreground)",
                    transition: "all 0.15s" }}>
                  {m === "rules_only" ? "Rules Only" : m === "mixed" ? "Mixed" : "ML Only"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ color: "var(--muted-foreground)", fontSize: 15 }}>
                Analyzing your trades…
              </p>
              <div style={{ marginTop: 16, height: 4, borderRadius: 2,
                background: "var(--muted)", overflow: "hidden" }}>
                <div className="skeleton" style={{ height: "100%" }} />
              </div>
            </div>
          ) : (
            <CSVUpload onUpload={handleUpload} isLoading={loading} />
          )}

          {error && (
            <div style={{ marginTop: 16, padding: "12px 18px", borderRadius: 8,
              background: "var(--danger-muted)", border: "1px solid var(--danger)",
              color: "var(--danger)", fontSize: 14 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main dashboard ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden",
      background: "var(--background)" }}>

      {/* Sidebar */}
      <aside style={{ width: 56, flexShrink: 0, background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)", display: "flex",
        flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 4 }}>

        {/* Logo */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>T</span>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              title={item.label}
              style={{ width: 40, height: 40, borderRadius: 8, border: "none",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", transition: "all 0.15s",
                background: active ? "var(--primary)" : "transparent",
                color: active ? "#fff" : "var(--muted-foreground)" }}>
              <Icon path={ICONS[item.iconKey]} size={17} />
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Reset button */}
        <button onClick={() => { setData(null); setCounterfactual(null); }}
          title="New Analysis"
          style={{ width: 40, height: 40, borderRadius: 8, border: "none",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", background: "transparent",
            color: "var(--muted-foreground)", marginBottom: 12 }}>
          <Icon path={ICONS.reset} size={16} />
        </button>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <header style={{ height: 48, flexShrink: 0, borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
          background: "var(--card)" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
            {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)",
            background: "var(--muted)", padding: "2px 8px", borderRadius: 4 }}>
            {data.normalized_trades.length} trades
            {data.feature_stats?.ml_active ? " · ML active" : ""}
          </span>
          <div style={{ marginLeft: "auto" }}>
            <ThemeToggle />
          </div>
        </header>

        {/* Stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10, padding: "14px 20px 0", flexShrink: 0 }}>
          <StatCard label="Total PnL"
            value={formatCurrency(stats!.totalPnl)}
            color={stats!.totalPnl >= 0 ? "var(--success)" : "var(--danger)"} />
          <StatCard label="Win Rate"
            value={`${(stats!.winRate * 100).toFixed(1)}%`}
            color={stats!.winRate >= 0.5 ? "var(--success)" : "var(--muted-foreground)"} />
          <StatCard label="Avg PnL"
            value={formatCurrency(stats!.avgPnl)}
            color={stats!.avgPnl >= 0 ? "var(--success)" : "var(--danger)"} />
          <StatCard label="Best Trade" value={formatCurrency(stats!.maxWin)}
            color="var(--success)" />
          <StatCard label="Worst Trade" value={formatCurrency(stats!.maxLoss)}
            color="var(--danger)" />
          <StatCard label="Flagged"
            value={String(data.flagged_trades.length)}
            color={data.flagged_trades.length > 0 ? "var(--primary)" : "var(--success)"} />
        </div>

        {/* Bias score cards — always visible */}
        <div style={{ padding: "14px 20px 0", flexShrink: 0 }}>
          <BiasScoreCards scores={data.bias_scores} trades={data.normalized_trades} />
        </div>

        {/* Active section */}
        <div style={{ flex: 1, padding: "14px 20px 20px", overflow: "auto" }}
          className="animate-fade-in">
          {activeSection === "insights" && (
            <InsightsCharts trades={data.normalized_trades}
              featureStats={data.feature_stats} biasEvidence={data.bias_evidence} />
          )}
          {activeSection === "timeline" && (
            <TradeTable trades={data.normalized_trades} flaggedTrades={data.flagged_trades} />
          )}
          {activeSection === "whatif" && (
            <CounterfactualPanel trades={data.normalized_trades} onResult={setCounterfactual} />
          )}
          {activeSection === "coaching" && (
            <CoachingTab analysisData={data} counterfactual={counterfactual} />
          )}
          {activeSection === "chat" && (
            <ChatPanel analysisData={data} />
          )}
        </div>
      </div>
    </div>
  );
}
