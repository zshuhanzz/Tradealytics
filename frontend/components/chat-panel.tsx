"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AnalyzeResponse, ChatMessage } from "@/types";
import { sendChatMessage } from "@/lib/api";

interface Props {
  analysisData: AnalyzeResponse;
}

export default function ChatPanel({ analysisData }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", text: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChatMessage(
        updated.map(m => ({ role: m.role, text: m.text })),
        analysisData as any
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Chat failed" }));
        throw new Error(err.detail || "Chat failed");
      }
      const data = await res.json();
      setMessages(prev => [...prev, { role: "model", text: data.reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "model", text: `Error: ${err.message || "Something went wrong."}` }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, analysisData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 400 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Tradealytics Chat
          </p>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
            Ask about your flagged trades & biases
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
              padding: "4px 8px", fontSize: 11, color: "var(--muted-foreground)", cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
        gap: 10, paddingRight: 4 }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", flex: 1, textAlign: "center", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              💬
            </div>
            <p style={{ fontSize: 13, color: "var(--foreground)", margin: 0, fontWeight: 500 }}>
              Ask me anything
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
              I can explain flagged trades, bias scores, and give advice
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.5,
              background: msg.role === "user" ? "var(--primary)" : "var(--card)",
              color: msg.role === "user" ? "#fff" : "var(--foreground)",
              border: msg.role === "model" ? "1px solid var(--border)" : "none",
              borderBottomRightRadius: msg.role === "user" ? 3 : 10,
              borderBottomLeftRadius: msg.role === "model" ? 3 : 10,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 16px", borderRadius: 10, background: "var(--card)",
              border: "1px solid var(--border)", display: "flex", gap: 5, alignItems: "center" }}>
              <span className="skeleton" style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
              <span className="skeleton" style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
              <span className="skeleton" style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12, flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your trades..."
          disabled={loading}
          style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--foreground)",
            outline: "none", opacity: loading ? 0.6 : 1 }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{ width: 38, height: 38, borderRadius: 8, background: "var(--primary)",
            color: "#fff", border: "none",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.4 : 1, display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0, transition: "opacity 0.15s" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
          </svg>
        </button>
      </form>
    </div>
  );
}
