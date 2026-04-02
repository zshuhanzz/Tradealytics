# Tradealytics

**AI-powered trading behavior analysis.** Upload your trade history, detect cognitive biases, visualize behavioral patterns, and get personalized coaching — powered by XGBoost ML and Google Gemini.

![Python](https://img.shields.io/badge/Python-3.11+-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-blueviolet?style=flat-square)

---

## Features

- **CSV Upload** — Drag-and-drop trade logs with automatic column detection
- **Bias Detection** — Identifies overtrading, loss aversion, and revenge trading with quantified scores
- **3 Analysis Modes** — Rules Only · Mixed (60/40) · ML Only
- **XGBoost ML** — 4-class classifier trained on 50-trade behavioral windows
- **Interactive Dashboard** — Heatmaps, PnL charts, sortable trade table, bias tags
- **Counterfactual Simulator** — Remove flagged trades and see the corrected PnL
- **AI Coaching** — Gemini-generated behavioral reports with journaling prompts
- **Session Tracking** — Track analysis sessions over time with trend charts
- **News Context** — Relevant market headlines with Gemini-explained emotional triggers
- **Dark Mode** — Full light/dark theme

---

## Financial Impact

Cognitive biases are among the biggest destroyers of trading profitability. Tradealytics quantifies their cost:

- **Overtrading** — Excess transaction costs and impulsive entries erode returns. Studies suggest overtraders underperform disciplined traders by 3–7% annually.
- **Loss Aversion** — Holding losers too long while cutting winners short leads to asymmetric drawdowns. This bias alone can flip a positive expectancy strategy negative.
- **Revenge Trading** — Aggressive re-entry after losses compounds drawdowns rapidly. A single revenge-trading episode can wipe out weeks of gains.
- **Counterfactual PnL** — The simulator shows you the *actual dollar difference* between your biased behavior and a disciplined baseline, making the cost of each bias concrete and measurable.

By identifying and correcting these behaviors, traders can recover a significant portion of returns lost to psychology rather than market conditions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | FastAPI, Python 3.11 |
| ML | XGBoost (4-class classifier, 18 behavioral features) |
| LLM | Google Gemini 2.5 Flash (coaching + news grounding) |
| Database | PostgreSQL (session tracking) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (for session tracking)

### 1. Clone & configure

```bash
git clone <repo-url> && cd tradealytics
```

Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/tradealytics
```

### 2. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### 3. Run both servers

```bash
# Backend (from project root)
python -m uvicorn backend.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## CSV Format

### Required Columns
| Column | Aliases Accepted |
|--------|-----------------|
| `timestamp` | time, date, datetime, executed_at |
| `side` | direction, type, action, buy_sell |
| `symbol` | asset, ticker, instrument, stock |
| `quantity` | qty, size, amount, volume, shares |
| `price` | entry_price, exec_price, fill_price |

### Optional Columns
| Column | Description |
|--------|-------------|
| `pnl` | Realized profit/loss per trade |
| `hold_minutes` | Duration of the trade |
| `entry_price` / `exit_price` | For detailed analysis |
| `balance` | Running account balance |

**Example:**
```csv
timestamp,side,symbol,quantity,price,pnl
2025-01-10 09:30:00,buy,AAPL,100,150.0,200
2025-01-10 09:31:00,sell,AAPL,100,149.0,-100
2025-01-10 09:35:00,buy,TSLA,50,220.0,-50
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Upload CSV → bias detection + ML scoring |
| `/api/counterfactual` | POST | Simulate removing biased trades |
| `/api/report` | POST | Generate Gemini coaching report |
| `/api/sessions` | GET/POST | Retrieve or save analysis sessions |
| `/api/trade-insights` | POST | Per-trade Gemini analysis |
| `/health` | GET | Health check |

---

## Project Structure

```
├── backend/
│   ├── api/            # FastAPI route handlers
│   ├── core/           # Analysis engine + schemas
│   ├── detectors/      # Rule-based bias detectors
│   ├── ml/             # XGBoost model + feature extraction
│   ├── llm/            # Gemini client + prompts
│   └── utils/          # Data loading, config, logging
├── frontend/
│   ├── app/            # Next.js pages + layout
│   ├── components/     # UI components
│   └── lib/            # API client + utilities
├── trading_datasets/   # Synthetic training data
└── shared/             # Cross-stack constants
```

---

## License

MIT
