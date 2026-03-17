"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import type { ColumnMapping } from "@/types";

const REQUIRED_FIELDS = ["timestamp", "side", "symbol", "quantity", "price"] as const;
const OPTIONAL_FIELDS = ["pnl", "hold_minutes"] as const;

const ALIASES: Record<string, string[]> = {
  timestamp:    ["time", "date", "datetime", "date_time", "trade_time", "executed_at"],
  side:         ["direction", "type", "action", "buy_sell", "order_side"],
  symbol:       ["asset", "ticker", "instrument", "stock", "coin", "pair", "name"],
  quantity:     ["qty", "size", "amount", "volume", "shares", "lots"],
  price:        ["entry_price", "exec_price", "fill_price", "avg_price", "trade_price"],
  pnl:          ["profit_loss", "profit", "pl", "p_l", "realized_pnl", "gain", "return"],
  hold_minutes: ["hold_time", "duration"],
};

function detectMapping(headers: string[]): Partial<ColumnMapping> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const mapping: Partial<ColumnMapping> = {};
  for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
    const direct = lower.indexOf(field);
    if (direct !== -1) { (mapping as any)[field] = headers[direct]; continue; }
    for (const alias of ALIASES[field] ?? []) {
      const idx = lower.indexOf(alias);
      if (idx !== -1) { (mapping as any)[field] = headers[idx]; break; }
    }
  }
  return mapping;
}

interface Props {
  onUpload: (file: File, mapping?: ColumnMapping) => void;
  isLoading: boolean;
}

export default function CSVUpload({ onUpload, isLoading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [error, setError] = useState<string | null>(null);

  const parseHeaders = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const hdrs = (text.split("\n")[0] || "")
        .split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      setHeaders(hdrs);
      setMapping(detectMapping(hdrs));
    };
    reader.readAsText(f);
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setError(null);
    parseHeaders(f);
  }, [parseHeaders]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "text/csv": [".csv"] }, multiple: false,
  });

  const handleSubmit = () => {
    if (!file) return;
    const missing = REQUIRED_FIELDS.filter((f) => !(mapping as any)[f]);
    if (missing.length > 0) {
      setError(`Map required columns: ${missing.join(", ")}`);
      return;
    }
    onUpload(file, mapping as ColumnMapping);
  };

  return (
    <div>
      <div {...getRootProps()} style={{
        border: `2px dashed ${isDragActive ? "var(--primary)" : "var(--border)"}`,
        borderRadius: 8, padding: "28px 20px", textAlign: "center", cursor: "pointer",
        background: isDragActive ? "var(--muted)" : "var(--card)", transition: "all 0.15s",
      }}>
        <input {...getInputProps()} />
        <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
        {file ? (
          <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, margin: 0 }}>
            {file.name}
            <span style={{ color: "var(--muted-foreground)", fontWeight: 400, marginLeft: 6 }}>
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--foreground)", margin: "0 0 4px" }}>
              {isDragActive ? "Drop it here" : "Drag & drop a CSV file"}
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>or click to browse</p>
          </>
        )}
      </div>

      {headers.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>
            Column mapping — auto-detected, adjust if needed
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
            {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
              <div key={field}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)",
                  display: "block", marginBottom: 3 }}>
                  {field}{REQUIRED_FIELDS.includes(field as any) ? " *" : ""}
                </label>
                <select
                  value={(mapping as any)[field] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))}
                  style={{ width: "100%", background: "var(--input-bg)",
                    border: "1px solid var(--border)", borderRadius: 6,
                    padding: "6px 8px", color: "var(--foreground)", fontSize: 12, outline: "none" }}>
                  <option value="">— not mapped —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6,
          background: "var(--danger-muted)", color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {file && (
        <button onClick={handleSubmit} disabled={isLoading}
          style={{ marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 6,
            background: "var(--primary)", color: "#fff", border: "none", fontWeight: 600,
            fontSize: 13, cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1, transition: "opacity 0.15s" }}>
          {isLoading ? "Analyzing…" : "Analyze Trades"}
        </button>
      )}
    </div>
  );
}
