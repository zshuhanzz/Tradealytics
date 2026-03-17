"use client";

import { useState } from "react";
import type {
  AnalyzeResponse,
  CounterfactualResponse,
  CoachingResponse,
  TradeInsightsResponse,
  TradeInsight,
} from "@/types";
import { fetchReport, fetchTradeInsights } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { formatCurrency } from "@/lib/utils";

interface Props {
  analysisData: AnalyzeResponse;
  counterfactual: CounterfactualResponse | null;
}

const BIAS_TAG_STYLE: Record<string, React.CSSProperties> = {
  overtrading:     { background: "rgba(249, 115, 22, 0.15)", color: "#F97316" },
  loss_aversion:   { background: "rgba(192, 57, 43, 0.15)",  color: "var(--danger)" },
  revenge_trading: { background: "rgba(147, 51, 234, 0.15)", color: "#9333EA" },
};

function TradeAccordion({ insight }: { insight: TradeInsight }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)",
            transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s",
            display: "inline-block", flexShrink: 0 }}>▶</span>
          <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600,
            background: "rgba(147, 51, 234, 0.15)", color: "#9333EA",
            padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
            {insight.symbol}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4,
            textTransform: "uppercase", flexShrink: 0,
            background: insight.side === "buy" ? "rgba(58, 168, 90, 0.15)" : "rgba(192, 57, 43, 0.15)",
            color: insight.side === "buy" ? "var(--success)" : "var(--danger)",
          }}>
            {insight.side}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>
            #{insight.trade_index}
          </span>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {insight.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 500,
                ...(BIAS_TAG_STYLE[tag] || { background: "var(--muted)", color: "var(--muted-foreground)" }),
              }}>
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, flexShrink: 0,
          color: insight.pnl >= 0 ? "var(--success)" : "var(--danger)" }}>
          {formatCurrency(insight.pnl)}
        </span>
      </button>

      {open && (
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "8px 12px", borderRadius: 6,
            background: "rgba(163, 68, 93, 0.08)", border: "1px solid rgba(163, 68, 93, 0.2)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", margin: "0 0 4px" }}>
              Flag Reason
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>{insight.reason}</p>
          </div>

          {insight.gemini_explanation && (
            <div style={{ padding: "8px 12px", borderRadius: 6,
              background: "rgba(163, 68, 93, 0.05)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>
                AI Analysis
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                {insight.gemini_explanation}
              </p>
            </div>
          )}

          {insight.market_context && (
            <div style={{ padding: "8px 12px", borderRadius: 6,
              background: "var(--muted)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>
                Market Context
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                {insight.market_context}
              </p>
              {insight.related_headlines.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {insight.related_headlines.map((h, i) => (
                    <p key={i} style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0,
                      paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>
                      {h}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachingTab({ analysisData, counterfactual }: Props) {
  const [report, setReport] = useState<CoachingResponse | null>(null);
  const [tradeInsights, setTradeInsights] = useState<TradeInsightsResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const generate = async () => {
    setLoadingReport(true);
    try {
      const analysis: Record<string, any> = {
        bias_scores: analysisData.bias_scores,
        feature_stats: analysisData.feature_stats,
        flagged_count: analysisData.flagged_trades.length,
      };
      if (counterfactual) {
        analysis.counterfactual = {
          original_pnl: counterfactual.original_pnl,
          counterfactual_pnl: counterfactual.counterfactual_pnl,
          pnl_delta: counterfactual.pnl_delta,
          removed_trades: counterfactual.removed_trades,
        };
      }
      const res = await fetchReport({ analysis });
      if (res.ok) setReport(await res.json());
    } finally {
      setLoadingReport(false);
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetchTradeInsights({
        flagged_trades: analysisData.flagged_trades,
        bias_scores: analysisData.bias_scores,
        normalized_trades: analysisData.normalized_trades,
      });
      if (res.ok) setTradeInsights(await res.json());
    } finally {
      setLoadingInsights(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "14px 16px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Coaching Report */}
      <div style={cardStyle}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)",
          margin: "0 0 14px" }}>
          AI Coaching Report
        </p>
        {!report ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 14px" }}>
              Generate a personalized coaching report powered by Gemini AI
            </p>
            <button onClick={generate} disabled={loadingReport}
              style={{ padding: "9px 24px", borderRadius: 6, border: "none",
                background: "var(--primary)", color: "#fff", fontWeight: 600,
                fontSize: 13, cursor: loadingReport ? "not-allowed" : "pointer",
                opacity: loadingReport ? 0.6 : 1 }}>
              {loadingReport ? "Generating…" : "Generate Report"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.7 }}>
              <ReactMarkdown>{report.report_markdown}</ReactMarkdown>
            </div>
            {report.coaching_plan.length > 0 && (
              <div style={{ background: "var(--muted)", borderRadius: 8, padding: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", margin: "0 0 10px" }}>
                  Action Plan
                </p>
                <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {report.coaching_plan.map((step, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--primary)",
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ color: "var(--muted-foreground)", paddingTop: 2, lineHeight: 1.5 }}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Per-Trade Insights */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: 0 }}>
            Per-Trade AI Insights
          </p>
          {analysisData.flagged_trades.length > 0 && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500,
              background: "rgba(163, 68, 93, 0.15)", color: "var(--primary)" }}>
              {analysisData.flagged_trades.length} flagged
            </span>
          )}
        </div>
        {!tradeInsights ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 4px" }}>
              Get AI-powered explanations for each flagged trade
            </p>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 14px" }}>
              Click each trade to see bias flags, AI analysis, and market context.
            </p>
            <button onClick={generateInsights}
              disabled={loadingInsights || analysisData.flagged_trades.length === 0}
              style={{ padding: "9px 24px", borderRadius: 6, border: "none",
                background: "var(--primary)", color: "#fff", fontWeight: 600,
                fontSize: 13, cursor: loadingInsights || analysisData.flagged_trades.length === 0
                  ? "not-allowed" : "pointer",
                opacity: loadingInsights || analysisData.flagged_trades.length === 0 ? 0.6 : 1 }}>
              {loadingInsights ? "Analyzing trades…" : "Analyze Flagged Trades"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ padding: "10px 14px", borderRadius: 8,
              background: "var(--muted)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                {tradeInsights.summary}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tradeInsights.insights.map((insight, i) => (
                <TradeAccordion key={i} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
