# 🔍 Tradealytics

**AI-powered trading behavior analysis.** Detect cognitive biases in your trading history, visualize behavioral patterns, simulate healthier behavior, and get personalized coaching — powered by XGBoost ML and Google Gemini.

> **QHacks 2026 — National Bank Bias Detector Challenge**

![Tradealytics](https://img.shields.io/badge/Tradealytics-v1.0-blue?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11+-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-blueviolet?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **CSV Upload** | Drag-and-drop trade logs with auto column detection (smart alias matching) |
| **3 Analysis Modes** | 📏 Rules Only · ⚖️ Mixed (60/40) · 🤖 ML Only — toggle on upload screen |
| **4 Bias Categories** | Overtrading · Loss Aversion · Revenge Trading · Calm (discipline score) |
| **XGBoost ML** | 4-class classifier trained on 50-trade windows with 18 behavioral features |
| **Interactive Dashboard** | Configurable heatmaps, PnL charts, sortable trade tables, bias tags |
| **Counterfactual Simulator** | "What-if" analysis — remove flagged trades and see corrected PnL |
| **AI Coaching** | Gemini-generated behavioral reports with journaling prompts |
| **News Context** | Grounded Google Search headlines + Gemini-explained emotional triggers |
| **Dark Mode** | Full light/dark theme with system preference detection |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                 │
│  App Router · TypeScript · Tailwind CSS · shadcn/ui     │
│  Recharts · drag-drop CSV · dark mode · loading skels   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────┐
│                    Backend (FastAPI)                     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Detectors│  │ ML Model │  │  LLM (Gemini 2.5)    │  │
│  │ Rules    │  │ XGBoost  │  │  Coaching + News      │  │
│  │ Engine   │  │ 4-class  │  │  Google Search Ground │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       └──────┬───────┘                   │              │
│         Analysis Engine                  │              │
│    (mode: rules / ml / mixed)            │              │
└──────────────────────────────────────────┘──────────────┘
```

### Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Upload CSV → bias detection + ML scoring |
| `/api/counterfactual` | POST | Simulate removing biased trades |
| `/api/report` | POST | Generate Gemini coaching report |
| `/api/news` | GET | Fetch headlines + Gemini context |
| `/api/trade-insights` | POST | Per-trade Gemini analysis |
| `/health` | GET | Health check |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+ (with pip)
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/)

### 1. Clone & configure

```bash
git clone <repo-url> && cd tradealytics
```

Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Install backend dependencies

```bash
pip install fastapi uvicorn pandas xgboost joblib scikit-learn google-generativeai python-multipart httpx
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run both servers

**Backend** (from project root):
```bash
python -m uvicorn backend.main:app --reload --port 8000
```

**Frontend** (from `frontend/`):
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📊 CSV Format

### Required Columns
| Column | Aliases Accepted |
|--------|-----------------|
| `timestamp` | time, date, datetime, executed_at |
| `side` | direction, type, action, buy_sell |
| `symbol` | asset, ticker, instrument, stock |
| `quantity` | qty, size, amount, volume, shares |
| `price` | entry_price, exec_price, fill_price |

### Optional Columns
| Column | Aliases Accepted |
|--------|-----------------|
| `pnl` | profit_loss, profit, realized_pnl, gain, return |
| `hold_minutes` | hold_time, duration |
| `entry_price` | (passthrough for judging) |
| `exit_price` | (passthrough for judging) |
| `balance` | (passthrough for judging) |

**Example:**
```csv
timestamp,side,symbol,quantity,price,pnl
2025-01-10 09:30:00,buy,AAPL,100,150.0,200
2025-01-10 09:31:00,sell,AAPL,100,149.0,-100
2025-01-10 09:35:00,buy,TSLA,50,220.0,-50
```

The upload form auto-detects column mappings, or you can manually map them.

---

## 🎛️ Analysis Modes

| Mode | Scoring Method | Best For |
|------|---------------|----------|
| **📏 Rules Only** | 100% hand-tuned rule-based detectors | Explainability, debugging |
| **⚖️ Mixed** (default) | 60% rules + 40% XGBoost ML | Balanced accuracy + interpretability |
| **🤖 ML Only** | 100% XGBoost model predictions | Maximum pattern detection |

---

## 🤖 Bias Detection

### Overtrading (📈)
Detects excessive trading frequency. Measures:
- Daily trade count vs. thresholds
- Burst trading (multiple trades within 60 seconds)
- Position switching (buy↔sell same symbol within 5 minutes)
- Score: 45% frequency + 30% burst + 25% switching

### Loss Aversion (🛡️)
Detects holding losers too long while cutting winners short. Measures:
- Hold-time ratio (losing vs winning trades)
- Loss-to-win size ratio (average loss ÷ average win)
- Risk-reward imbalance
- Score: 50% hold-time + 50% size ratio

### Revenge Trading (🔥)
Detects aggressive re-entry after losses. Measures:
- Trades within 30 minutes of a loss with size increase
- Streak-based detection (2+ consecutive losses → size increase)
- Combined score from single-loss + streak events

### Calm (🧘)
Discipline score — the inverse of bias presence. A high calm score means the trader is disciplined with low bias signals across all categories. Blends rule-based inverse scoring with ML calm probability.

---

## 🧠 ML Pipeline

### XGBoost 4-Class Classifier
- **Classes:** calm, loss_aversion, overtrading, revenge_trading
- **Training:** 4 synthetic datasets × 10,000 trades, windowed into 50-trade chunks (stride 25)
- **Model:** XGBClassifier, 200 estimators, max_depth=6, `multi:softprob`
- **Inference:** Trades split into 50-trade windows → predict each → average probabilities

### 18 Behavioral Features
| # | Feature | Description |
|---|---------|-------------|
| 1 | `trades_per_hour` | Trading frequency |
| 2 | `mean_time_between_trades_sec` | Average gap between trades |
| 3 | `std_time_between_trades_sec` | Volatility of trading pace |
| 4 | `burst_count_60s` | Trades within 60-second clusters |
| 5 | `pnl_mean` | Average PnL per trade |
| 6 | `pnl_std` | PnL volatility |
| 7 | `pnl_total` | Cumulative PnL |
| 8 | `win_rate` | Fraction of profitable trades |
| 9 | `avg_quantity` | Average position size |
| 10 | `std_quantity` | Position size volatility |
| 11 | `avg_trade_value` | Average trade notional value |
| 12 | `loss_hold_to_win_hold_ratio` | Hold-time ratio (losers ÷ winners) |
| 13 | `avg_size_after_loss_ratio` | Size increase after losses |
| 14 | `reentry_after_loss_mean_sec` | Speed of re-entry after loss |
| 15 | `consecutive_loss_streak_max` | Longest losing streak |
| 16 | `side_switch_rate` | Buy↔sell alternation frequency |
| 17 | `unique_symbols` | Number of instruments traded |
| 18 | `balance_drawdown_pct` | Maximum balance drawdown |

### Retrain the Model
```bash
python -m backend.ml.train_xgboost
```
Saves to `backend/ml/saved_models/bias_xgb.joblib`.

---

## 🔑 API Keys

| Key | Service | Get it at |
|-----|---------|-----------|
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash | [Google AI Studio](https://aistudio.google.com/) |

Set in `.env` file or export as environment variable.

---

## 🧪 Testing

```bash
# Run all backend tests
python -m pytest backend/tests/ -v

# Test a specific dataset via API
curl -s -X POST http://localhost:8000/api/analyze \
  -F "file=@trading_datasets/overtrader.csv" \
  -F "analysis_mode=mixed" | python -m json.tool
```

---

## 📁 Project Structure

```
├── backend/
│   ├── api/                    # FastAPI route handlers
│   │   ├── analyze.py          # CSV upload → bias analysis
│   │   ├── counterfactual.py   # What-if trade simulation
│   │   ├── report.py           # Gemini coaching report
│   │   ├── news.py             # News headlines + context
│   │   └── trade_insights.py   # Per-trade Gemini insights
│   ├── core/
│   │   ├── analysis_engine.py  # Orchestrator (rules + ML + scoring)
│   │   └── schemas.py          # Pydantic models
│   ├── detectors/
│   │   ├── overtrading.py      # Frequency + burst + switching
│   │   ├── loss_aversion.py    # Hold-time + size ratio
│   │   └── revenge_trading.py  # Post-loss aggression + streaks
│   ├── ml/
│   │   ├── features.py         # 18-feature extraction + windowing
│   │   ├── model.py            # XGBoost classifier wrapper
│   │   ├── train_xgboost.py    # Training script (4-class)
│   │   └── saved_models/       # bias_xgb.joblib + report
│   ├── llm/
│   │   ├── gemini_client.py    # Gemini API + Google Search grounding
│   │   └── prompts.py          # Coaching + news + insight prompts
│   ├── utils/
│   │   ├── data_loader.py      # CSV parsing + column mapping
│   │   ├── config.py           # Environment config
│   │   └── logger.py           # Structured logging
│   ├── tests/
│   │   └── test_detectors.py   # 6 unit tests
│   └── main.py                 # FastAPI app entry point
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Main page (upload → results)
│   │   ├── layout.tsx          # Root layout + theme
│   │   └── globals.css         # Tailwind + animations + dark mode
│   ├── components/
│   │   ├── csv-upload.tsx       # Drag-drop + auto column mapping
│   │   ├── bias-scorecards.tsx  # 4-card bias + calm grid
│   │   ├── insights-charts.tsx  # Configurable heatmap + PnL charts
│   │   ├── trade-table.tsx      # Sortable trade timeline
│   │   ├── counterfactual-panel.tsx  # What-if simulator
│   │   ├── coaching-tab.tsx     # AI coaching accordion
│   │   ├── news-tab.tsx         # News + Gemini context
│   │   └── theme-toggle.tsx     # Dark/light mode switch
│   ├── lib/
│   │   ├── api.ts              # API client + analysis modes
│   │   └── utils.ts            # Formatting utilities
│   └── types/index.ts          # TypeScript interfaces
├── trading_datasets/           # Synthetic training data (4 × 10K trades)
├── shared/                     # Cross-stack constants
└── README.md
```

---

## 🏆 Challenge Alignment

This project is built for the **National Bank Bias Detector Challenge** at QHacks 2026:

- ✅ Detects multiple trading biases with quantified scores
- ✅ Uses ML (XGBoost) alongside rule-based detectors
- ✅ Provides AI-powered coaching and improvement plans (Gemini)
- ✅ Interactive dashboard with configurable visualizations
- ✅ Counterfactual "what-if" simulations
- ✅ Supports the 20x judging dataset format (entry_price, exit_price, balance passthrough)
- ✅ News context with grounded Google Search

---

## License

MIT
