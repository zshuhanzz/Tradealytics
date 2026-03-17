"use client";

import { useState, useRef, useCallback } from "react";
import type { BiasScore, ShapExplainResponse } from "@/types";
import { fetchShapExplain } from "@/lib/api";
import ShapStackedChart from "./shap-stacked-chart";

interface Props {
  scores: Record<string, BiasScore>;
  trades?: Record<string, any>[];
}

const BIAS_CONFIG: Record<string, { label: string; emoji: string; borderColor: string }> = {
  calm:            { label: "Calm / Disciplined", emoji: "🧘", borderColor: "var(--success)" },
  overtrading:     { label: "Overtrading",         emoji: "⚡", borderColor: "#F97316" },
  loss_aversion:   { label: "Loss Aversion",       emoji: "😰", borderColor: "var(--danger)" },
  revenge_trading: { label: "Revenge Trading",     emoji: "🔥", borderColor: "#9333EA" },
};

function scoreColor(score: number, isCalm: boolean): string {
  if (isCalm) return score >= 60 ? "var(--success)" : score >= 30 ? "#F97316" : "var(--danger)";
  return score > 50 ? "var(--danger)" : score > 30 ? "#F97316" : "var(--success)";
}

export default function BiasScoreCards({ scores, trades }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [shapData, setShapData] = useState<ShapExplainResponse | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [shapError, setShapError] = useState<string | null>(null);
  const shapFetched = useRef(false);

  const loadShapData = useCallback(async () => {
    if (shapFetched.current || !trades || trades.length === 0) return;
    shapFetched.current = true;
    setShapLoading(true);
    setShapError(null);
    try {
      const res = await fetchShapExplain(trades);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || "SHAP computation failed");
      }
      setShapData(await res.json());
    } catch (err: any) {
      setShapError(err.message);
      shapFetched.current = false;
    } finally {
      setShapLoading(false);
    }
  }, [trades]);

  const handleCardClick = (key: string) => {
    if (expandedKey === key) { setExpandedKey(null); return; }
    setExpandedKey(key);
    if (!shapData && !shapLoading) loadShapData();
  };

  const orderedKeys = ["calm", "overtrading", "loss_aversion", "revenge_trading"].filter(k => k in scores);
  Object.keys(scores).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k); });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {orderedKeys.map((key) => {
        const bias = scores[key];
        const isCalm = key === "calm";
        const isExpanded = expandedKey === key;
        const config = BIAS_CONFIG[key] || { label: key, emoji: "📊", borderColor: "var(--border)" };

        return (
          <div
            key={key}
            onClick={() => handleCardClick(key)}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${config.borderColor}`,
              borderRadius: 8,
              padding: "12px 14px",
              cursor: "pointer",
              gridColumn: isExpanded ? "span 4" : undefined,
              transition: "border-color 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{config.emoji}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{config.label}</p>
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                    {isCalm
                      ? (bias.score >= 60 ? "disciplined" : bias.score >= 30 ? "moderate" : "low discipline")
                      : `${bias.severity} severity`}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor(bias.score, isCalm) }}>
                  {bias.score.toFixed(0)}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" style={{ color: "var(--muted-foreground)",
                    transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div style={{ height: 3, borderRadius: 2, background: "var(--muted)", marginBottom: 8 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.min(bias.score, 100)}%`,
                background: config.borderColor,
                transition: "width 0.5s",
              }} />
            </div>

            <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: isExpanded ? undefined : 2,
              WebkitBoxOrient: "vertical" as const }}>
              {bias.rationale}
            </p>

            {isExpanded && (
              <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                {shapLoading && (
                  <div style={{ textAlign: "center", padding: "24px 0",
                    color: "var(--muted-foreground)", fontSize: 13 }}>
                    Computing SHAP explanations…
                  </div>
                )}
                {shapError && (
                  <div style={{ padding: "8px 12px", borderRadius: 6,
                    background: "var(--danger-muted)", color: "var(--danger)", fontSize: 12 }}>
                    {shapError}
                  </div>
                )}
                {shapData && trades && (
                  <ShapStackedChart shapData={shapData} biasClass={key} trades={trades} />
                )}
                {!shapLoading && !shapError && !shapData && !trades?.length && (
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", padding: "16px 0" }}>
                    No trade data available for SHAP analysis.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
