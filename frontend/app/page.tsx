"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { AnalyzeResponse, ColumnMapping, CounterfactualResponse, User } from "@/types";
import { analyzeCSV, lookupUser, createUser, saveSession, type AnalysisMode } from "@/lib/api";
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
  userPlus:    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
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

  // ── User state ──
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState("Shuhan");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "found" | "not_found">("idle");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
        setCreateError(null);
        setNewUsername("");
      }
    };
    if (showProfileMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  const handleUserLookup = async () => {
    if (!usernameInput.trim()) return;
    setLookupLoading(true);
    setLookupStatus("idle");
    try {
      const res = await lookupUser(usernameInput.trim());
      if (res.ok) {
        const user: User = await res.json();
        setCurrentUser(user);
        setLookupStatus("found");
      } else {
        setCurrentUser(null);
        setLookupStatus("not_found");
      }
    } catch {
      setLookupStatus("not_found");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await createUser(newUsername.trim());
      if (res.ok) {
        const user: User = await res.json();
        setCurrentUser(user);
        setShowProfileMenu(false);
        setNewUsername("");
      } else {
        const err = await res.json().catch(() => ({ detail: "Failed to create account" }));
        setCreateError(err.detail || "Failed to create account");
      }
    } catch {
      setCreateError("Failed to create account");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpload = async (file: File, mapping?: ColumnMapping) => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeCSV(file, mapping as any, analysisMode);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || "Analysis failed");
      }
      const result = await res.json();
      setData(result);

      // Save session to DB (fire-and-forget, don't block UI)
      saveSession({
        user_id: currentUser?.id,
        analysis_mode: analysisMode,
        trade_count: result.feature_stats?.trade_count ?? 0,
        overtrading_score: result.bias_scores?.overtrading?.score ?? 0,
        loss_aversion_score: result.bias_scores?.loss_aversion?.score ?? 0,
        revenge_score: result.bias_scores?.revenge_trading?.score ?? 0,
        calm_score: result.bias_scores?.calm?.score ?? 0,
      }).catch(() => {}); // silently ignore if DB is unreachable
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

  // ── Upload/loading screen ─────────────────────────────────────────────────
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", position: "relative",
        backgroundImage: "var(--bg-image)", backgroundSize: "cover",
        backgroundPosition: "center", backgroundColor: "var(--background)" }}>
        {/* Theme toggle — top right */}
        <div style={{ position: "absolute", top: 28, right: 80 }}>
          <ThemeToggle />
        </div>
        <div style={{ width: "100%", maxWidth: 640, padding: "0 32px" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <img src="/images/tradealytics_logo_t.png" alt="Tradealytics"
              style={{ width: 280, height: 280, objectFit: "contain", margin: "10px auto -60px", display: "block" }} />
            <h1 style={{ fontSize: 36, fontWeight: 700, margin: "0 0 10px",
              color: "var(--foreground)" }}>Tradealytics</h1>
            <p style={{ fontSize: 15, color: "var(--foreground)", margin: 0, lineHeight: 1.6 }}>
              Upload your trade log to detect behavioral biases and get AI coaching.
            </p>
          </div>

          {/* Username lookup */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: "var(--foreground)", marginBottom: 8,
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Your Username
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={usernameInput}
                onChange={(e) => { setUsernameInput(e.target.value); setLookupStatus("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && handleUserLookup()}
                placeholder="Enter username"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "var(--muted)", border: "1px solid var(--border)",
                  color: "var(--foreground)", outline: "none" }}
              />
              <button
                onClick={handleUserLookup}
                disabled={lookupLoading || !usernameInput.trim()}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "var(--primary)", color: "#fff", fontWeight: 600,
                  fontSize: 14, cursor: "pointer", opacity: lookupLoading ? 0.6 : 1 }}>
                {lookupLoading ? "…" : "Enter"}
              </button>
            </div>
            {lookupStatus === "found" && currentUser && (
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--success)", fontWeight: 500 }}>
                Welcome back, {currentUser.username}!
              </p>
            )}
            {lookupStatus === "not_found" && (
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted-foreground)" }}>
                User not found. You can create an account after analyzing.
              </p>
            )}
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

          {/* Analysis mode */}
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, color: "var(--foreground)", marginBottom: 10,
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Analysis Method</p>
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
        <div style={{ marginBottom: 8 }}>
          <img src="/images/tradealytics_logo_t.png" alt="Tradealytics"
            style={{ width: 40, height: 40, objectFit: "contain" }} />
        </div>

        {/* Profile button */}
        <div style={{ position: "relative", marginBottom: 8 }} ref={profileMenuRef}>
          <button
            onClick={() => { setShowProfileMenu((v) => !v); setCreateError(null); setNewUsername(""); }}
            title={currentUser ? currentUser.username : "Create Account"}
            style={{ width: 40, height: 40, borderRadius: 8, border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              background: currentUser ? "var(--primary)" : "transparent",
              color: currentUser ? "#fff" : "var(--muted-foreground)", transition: "all 0.15s",
              fontSize: 13, fontWeight: 700 }}>
            {currentUser
              ? currentUser.username.charAt(0).toUpperCase()
              : <Icon path={ICONS.userPlus} size={17} />}
          </button>

          {/* Profile panel */}
          {showProfileMenu && (
            <div style={{ position: "absolute", left: 48, top: 0, zIndex: 50,
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: 14, width: 220, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              {currentUser ? (
                <div>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    Logged in as
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
                    {currentUser.username}
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)",
                    marginBottom: 10 }}>
                    Create Account
                  </p>
                  <input
                    value={newUsername}
                    onChange={(e) => { setNewUsername(e.target.value); setCreateError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
                    placeholder="Choose a username"
                    autoFocus
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13,
                      background: "var(--muted)", border: `1px solid ${createError ? "var(--danger)" : "var(--border)"}`,
                      color: "var(--foreground)", outline: "none", boxSizing: "border-box" }}
                  />
                  {createError && (
                    <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>
                      {createError}
                    </p>
                  )}
                  <button
                    onClick={handleCreateUser}
                    disabled={createLoading || !newUsername.trim()}
                    style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 6,
                      border: "none", background: "var(--primary)", color: "#fff",
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                      opacity: createLoading || !newUsername.trim() ? 0.6 : 1 }}>
                    {createLoading ? "Creating…" : "Create"}
                  </button>
                </div>
              )}
            </div>
          )}
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
