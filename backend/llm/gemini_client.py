from __future__ import annotations

import json
import logging
import re
import threading
import time
from typing import Any

import requests

from backend.llm.prompts import BIAS_COACHING_PROMPT, CHAT_SYSTEM_PROMPT, SYSTEM_PROMPT, TRADE_INSIGHTS_PROMPT
from backend.utils.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_api_lock = threading.Lock()
_last_call_time: float = 0.0
_MIN_CALL_GAP = 4.0  # seconds — free tier is ~15 RPM


class GeminiClient:
    MAX_RETRIES = 2
    RETRY_WAIT = 5.0

    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY not set – Gemini calls will fail.")

    def _call_api(self, payload: dict) -> dict:
        global _last_call_time

        if not self.settings.gemini_api_key:
            raise RuntimeError("Gemini API key not configured. Set GEMINI_API_KEY in your .env file.")

        url = GEMINI_API_URL.format(model=self.settings.gemini_model)

        for attempt in range(self.MAX_RETRIES + 1):
            with _api_lock:
                elapsed = time.time() - _last_call_time
                if elapsed < _MIN_CALL_GAP:
                    time.sleep(_MIN_CALL_GAP - elapsed)

                try:
                    response = requests.post(
                        url,
                        params={"key": self.settings.gemini_api_key},
                        json=payload,
                        timeout=90,
                    )
                    _last_call_time = time.time()
                    response.raise_for_status()
                    return response.json()
                except requests.RequestException as exc:
                    _last_call_time = time.time()
                    status = getattr(getattr(exc, "response", None), "status_code", None)
                    if status in (429, 500, 502, 503) and attempt < self.MAX_RETRIES:
                        logger.warning("Gemini %s – retrying in %.0fs", status, self.RETRY_WAIT)
                        time.sleep(self.RETRY_WAIT)
                        continue
                    raise RuntimeError(f"Gemini API error: {exc}") from exc

        raise RuntimeError(f"Gemini API failed after {self.MAX_RETRIES + 1} attempts.")

    def generate(self, prompt: str) -> str:
        if not self.settings.gemini_api_key:
            return "_Gemini API key not configured._"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}]}]
        }
        data = self._call_api(payload)
        return data["candidates"][0]["content"]["parts"][0]["text"]

    def chat(self, messages: list[dict[str, str]], analysis_context: str) -> str:
        if not self.settings.gemini_api_key:
            return "_Gemini API key not configured._"
        system_text = CHAT_SYSTEM_PROMPT.format(analysis_context=analysis_context)
        contents = [
            {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["text"]}]}
            for m in messages
        ]
        payload = {
            "system_instruction": {"parts": [{"text": system_text}]},
            "contents": contents,
        }
        data = self._call_api(payload)
        return data["candidates"][0]["content"]["parts"][0]["text"]

    def generate_grounded(self, prompt: str) -> dict[str, Any]:
        if not self.settings.gemini_api_key:
            return {"text": "_Gemini API key not configured._", "sources": [], "search_queries": []}

        payload = {
            "contents": [{"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}]}],
            "tools": [{"google_search": {}}],
        }
        data = self._call_api(payload)
        candidate = data["candidates"][0]
        text = candidate["content"]["parts"][0]["text"]

        grounding = candidate.get("groundingMetadata", {})
        search_queries = grounding.get("webSearchQueries", [])
        sources = []
        for chunk in grounding.get("groundingChunks", []):
            web = chunk.get("web", {})
            url = web.get("uri", "")
            title = web.get("title", "")
            if url and ("vertexaisearch" in url or not url.startswith("https://")):
                url = ""
            if title or url:
                sources.append({"title": title, "url": url})

        return {"text": text, "sources": sources, "search_queries": search_queries}


# ── Coaching ───────────────────────────────────────────────────────────────────

def generate_coaching_report(
    analysis: dict[str, Any],
    counterfactual: dict[str, Any] | None = None,
) -> tuple[str, list[str]]:
    client = GeminiClient()
    bias_summary = json.dumps(analysis.get("bias_scores", {}), indent=2)
    cf_text = json.dumps(counterfactual, indent=2) if counterfactual else "Not available."
    report = client.generate(BIAS_COACHING_PROMPT.format(bias_summary=bias_summary, counterfactual=cf_text))

    plan = [l.strip() for l in report.split("\n")
            if l.strip() and l.strip()[0].isdigit() and "." in l.strip()[:4]]
    if not plan:
        plan = [
            "Day 1–2: Review flagged trades and journal observations.",
            "Day 3–4: Set max trade limits and cooldown timers.",
            "Day 5–6: Practice mindful entry criteria before each trade.",
            "Day 7: Evaluate progress and adjust rules.",
        ]
    return report, plan


# ── Trade Insights ─────────────────────────────────────────────────────────────

def generate_trade_insights(
    flagged_trades: list[dict[str, Any]],
    bias_scores: dict[str, Any],
    search_context: str = "",
) -> list[dict[str, Any]]:
    client = GeminiClient()

    trades_text = ""
    for t in flagged_trades[:20]:
        trades_text += (
            f"- Trade #{t.get('trade_index', '?')}: {t.get('symbol', '?')} "
            f"{t.get('side', '?')} | PnL: {t.get('pnl', 0):.2f} | "
            f"Time: {t.get('timestamp', '?')} | "
            f"Bias tags: {', '.join(t.get('tags', []))} | "
            f"Reason: {t.get('reason', 'N/A')}\n"
        )

    prompt = TRADE_INSIGHTS_PROMPT.format(
        bias_scores=json.dumps(bias_scores, indent=2, default=str),
        flagged_trades=trades_text,
        search_context=search_context,
    )

    result = client.generate_grounded(prompt)
    raw = result["text"]
    source_titles = [s["title"] for s in result.get("sources", [])]

    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            parsed = json.loads(raw[start:end])
            for item in parsed:
                if not item.get("related_headlines"):
                    item["related_headlines"] = source_titles[:3]
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass

    return [
        {
            "trade_index": t.get("trade_index", i),
            "gemini_explanation": "AI analysis unavailable. Review the bias flags manually.",
            "market_context": "Market context could not be generated.",
            "related_headlines": source_titles[:3],
        }
        for i, t in enumerate(flagged_trades)
    ]
