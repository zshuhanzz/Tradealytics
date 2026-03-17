# 🎬 BiasLens Demo Script

> Step-by-step walkthrough for QHacks 2026 judges and live presentation.

---

## 🚀 Setup (Before Demo)

```bash
# Terminal 1 — Backend
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Flow (3-5 minutes)

### 1️⃣ Landing Page (15 seconds)

> "This is BiasLens — an AI-powered trading behavior analyzer. Traders upload their trade logs, and we detect cognitive biases using a blend of rule-based detectors and machine learning."

- Point out the **BiasLens** branding and subtitle
- Show the **3 analysis mode buttons**: Rules Only · Mixed · ML Only
- Toggle to **⚖️ Mixed** (default — 60% rules + 40% XGBoost)

### 2️⃣ Upload a Dataset (20 seconds)

> "Let's analyze a trader with revenge trading behavior — someone who aggressively re-enters after losses."

- Drag-and-drop `trading_datasets/revenge_trader.csv` into the upload zone
- Point out the **auto-detected column mapping** (timestamp, side, symbol, etc.)
- Click **Analyze**
- Show the **loading skeleton** animation while processing

### 3️⃣ Results Dashboard (60 seconds)

> "Instantly, we get a comprehensive behavioral profile."

**Stat Strip:**
- Point out Total Trades, Total PnL, Win Rate, Flagged count
- "This trader has ~9,600 trades with a significant number flagged."

**Bias Score Cards:**
- 🧘 **Calm: 11%** → "Very low discipline score"
- 🔥 **Revenge Trading: 91%** → "Our detectors correctly identify this as the dominant bias"
- 📈 **Overtrading: 60%** → "Moderate overtrading detected"
- 🛡️ **Loss Aversion: 3%** → "Low — this trader doesn't hesitate to cut losses"

**Analysis Mode Badge:**
- "Notice the green badge — we're using Mixed mode, blending 60% rule-based analysis with 40% XGBoost ML predictions."

### 4️⃣ Insights Tab (45 seconds)

> "The Insights tab gives us deep visual analytics."

- **Configurable Heatmap:** Show trade density by hour/weekday
  - Toggle Density to "PnL" to see where the trader makes/loses money
  - Toggle Columns to "Session" to see market-session breakdown
- **PnL Distribution Charts:** Point out the trade distribution patterns

### 5️⃣ Timeline Tab (20 seconds)

> "Every trade is tagged with detected biases."

- Scroll through the trade table
- Point out color-coded bias tags (🔥 revenge, ⚡ overtrading)
- Show sorting by PnL to find worst trades

### 6️⃣ What-If Simulator (30 seconds)

> "The What-If tab lets us simulate removing biased trades."

- Click **Run Simulation**
- "If we removed all flagged revenge trades, the trader's PnL would improve by $X"
- Show the before/after comparison

### 7️⃣ AI Coaching (30 seconds)

> "Powered by Google Gemini 2.5 Flash, we generate personalized coaching."

- Expand the coaching accordion
- "Each insight includes specific behavioral observations, actionable advice, and journaling prompts"
- Point out the structured format: observation → recommendation → journal prompt

### 8️⃣ News Context (15 seconds)

> "We also pull real market news via grounded Google Search to explain potential emotional triggers."

- Show relevant headlines with Gemini-generated context
- "This helps traders understand external factors that may have influenced their decisions."

### 9️⃣ Compare Modes (30 seconds)

> "Let me show you the power of our multi-mode analysis."

- Click **New Analysis** button (top right)
- Re-upload the same dataset but switch to **🤖 ML Only**
- Compare the scores — "ML picks up patterns the rules miss, and vice versa"
- Show the violet badge confirming ML-only mode

### 🔟 Dark Mode (10 seconds)

- Click the **🌙 theme toggle** in the header
- "Full dark mode support for comfortable analysis"

---

## Key Technical Talking Points

1. **Dual Engine:** "We combine hand-tuned rule detectors with an XGBoost classifier trained on 40,000 synthetic trades across 4 behavioral profiles."

2. **Windowed ML:** "The ML model was trained on 50-trade windows. At inference, we split the dataset into overlapping windows, predict each, and average — matching training conditions exactly."

3. **18 Behavioral Features:** "We extract 18 features per window including trading frequency, burst detection, PnL patterns, position sizing after losses, side-switching rate, and drawdown metrics."

4. **Gemini Integration:** "Google Gemini 2.5 Flash provides coaching with grounded Google Search for real market context — no hallucinated news."

5. **Flexible Input:** "Smart column detection with 7+ aliases per field means we handle any CSV format — including the 20-trade judging dataset with entry_price, exit_price, and balance columns."

---

## Backup: Quick API Demo

If the frontend has issues, demonstrate via terminal:

```bash
# Analyze a dataset
curl -s -X POST http://localhost:8000/api/analyze \
  -F "file=@trading_datasets/revenge_trader.csv" \
  -F "analysis_mode=mixed" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Trades analyzed: {len(d[\"normalized_trades\"])}')
print(f'Flagged trades: {len(d[\"flagged_trades\"])}')
for k, v in d['bias_scores'].items():
    print(f'  {k}: {v[\"score\"]:.1f}/100 ({v[\"severity\"]})')
"
```

Expected output:
```
Trades analyzed: 9611
Flagged trades: ~7000+
  overtrading: 60.1/100 (medium)
  loss_aversion: 3.3/100 (low)
  revenge_trading: 91.5/100 (high)
  calm: 11.3/100 (high)
```

---

## Datasets Available

| File | Expected Top Bias | Description |
|------|------------------|-------------|
| `overtrader.csv` | Overtrading (68%) | High frequency, burst trading |
| `calm_trader.csv` | None dominant | Disciplined, steady trading |
| `loss_averse_trader.csv` | Loss Aversion (64%) | Holds losers, cuts winners |
| `revenge_trader.csv` | Revenge Trading (91%) | Aggressive re-entry after losses |

---

*Good luck! 🚀*
