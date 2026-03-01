# 🧿 @backtest-kit/sidekick

> The easiest way to create a new Backtest Kit trading bot project. Scaffolds a multi-timeframe crypto trading strategy with Pine Script indicators via [PineTS](https://github.com/QuantForgeOrg/PineTS) runtime, 4H trend filter + 15m signal generator, partial profit taking, breakeven trailing stops, and risk validation.

![screenshot](https://raw.githubusercontent.com/tripolskypetr/backtest-kit/HEAD/assets/screenshots/screenshot16.png)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tripolskypetr/backtest-kit)
[![npm](https://img.shields.io/npm/v/@backtest-kit/sidekick.svg?style=flat-square)](https://npmjs.org/package/@backtest-kit/sidekick)
[![License](https://img.shields.io/npm/l/@backtest-kit/sidekick.svg)](https://github.com/tripolskypetr/backtest-kit/blob/master/LICENSE)

📚 **[Backtest Kit Docs](https://backtest-kit.github.io/documents/example_02_first_backtest.html)** | 🌟 **[GitHub](https://github.com/tripolskypetr/backtest-kit)**

## ✨ Features

- 🚀 **Zero Config**: Get started with one command - no setup required
- 📊 **Multi-timeframe analysis** — 4H daily trend filter (RSI + MACD + ADX) combined with 15m entry signals (EMA crossover + volume spike + momentum)
- 📜 **Pine Script indicators** — strategies written in TradingView Pine Script v5, executed locally via `@backtest-kit/pinets`
- 🛡️ **Risk management** — SL/TP distance validation, Kelly-optimized partial profit taking (33/33/34%), breakeven trailing stop
- 🔄 **Position lifecycle** — full monitoring with scheduled/opened/closed/cancelled event logging
- 🔌 **Binance integration** — OHLCV candles, order book depth, tick-precise price/quantity formatting via CCXT
- 🕐 **Historical frames** — predefined backtest periods covering bull runs, sharp drops, and sideways markets
- 🎨 **Web UI dashboard** — interactive charting via `@backtest-kit/ui`
- 💾 **Persistent storage** — crash-safe state with atomic persistence for both backtest and live modes

## 🚀 Quick Start

### Create a New Project

```bash
npx -y @backtest-kit/sidekick my-trading-bot
cd my-trading-bot
npm start
```

That's it! You now have a working trading bot with:
- Multi-timeframe Pine Script strategy (4H trend + 15m signals)
- Risk management validation (SL/TP distance checks)
- Partial profit taking and breakeven trailing stops
- Cache utilities and debug scripts
- CLAUDE.md for AI-assisted strategy iteration
- Environment configuration

## 🏗️ Generated Project Structure

```
my-trading-bot/
├── src/
│   ├── index.mjs                  # Entry point — loads config, logic, bootstrap
│   ├── main/bootstrap.mjs         # Mode dispatcher (backtest / paper / live)
│   ├── config/
│   │   ├── setup.mjs              # Logger, storage, notifications, UI server
│   │   ├── validate.mjs           # Schema validation for all enums
│   │   ├── params.mjs             # Environment variables (Ollama API key)
│   │   └── ccxt.mjs               # Binance exchange singleton via CCXT
│   ├── logic/
│   │   ├── strategy/main.strategy.mjs    # Main strategy — multi-TF signal logic
│   │   ├── exchange/binance.exchange.mjs # Exchange schema — candles, order book, formatting
│   │   ├── frame/*.frame.mjs             # Backtest time frames (Feb 2024, Oct–Dec 2025)
│   │   ├── risk/sl_distance.risk.mjs     # Stop-loss distance validation (≥0.2%)
│   │   ├── risk/tp_distance.risk.mjs     # Take-profit distance validation (≥0.2%)
│   │   └── action/
│   │       ├── backtest_partial_profit_taking.action.mjs
│   │       ├── backtest_lower_stop_on_breakeven.action.mjs
│   │       └── backtest_position_monitor.action.mjs
│   ├── classes/
│   │   ├── BacktestPartialProfitTakingAction.mjs  # Scale out at 3 TP levels
│   │   ├── BacktestLowerStopOnBreakevenAction.mjs # Trailing stop on breakeven
│   │   └── BacktestPositionMonitorAction.mjs      # Position event logger
│   ├── math/
│   │   ├── timeframe_4h.math.mjs   # 4H trend data — RSI, MACD, ADX, DI+/DI-
│   │   └── timeframe_15m.math.mjs  # 15m signal data — EMA, ATR, volume, momentum
│   ├── enum/                        # String constants for type-safe schema refs
│   └── utils/getArgs.mjs            # CLI argument parser with defaults
├── config/source/
│   ├── timeframe_4h.pine    # Pine Script v5 — Daily Trend Filter (RSI/MACD/ADX)
│   └── timeframe_15m.pine   # Pine Script v5 — Signal Strategy (EMA/ATR/Volume)
├── scripts/
│   ├── run_timeframe_15m.mjs # Standalone 15m Pine Script runner
│   ├── run_timeframe_4h.mjs  # Standalone 4H Pine Script runner
│   └── cache/
│       ├── cache_candles.mjs     # Pre-download OHLCV candles (1m/15m/4h)
│       ├── validate_candles.mjs  # Verify cached candle data integrity
│       └── cache_model.mjs       # Pull Ollama LLM model with progress bar
├── docker/ollama/
│   ├── docker-compose.yaml   # Ollama GPU container setup
│   └── watch.sh              # nvidia-smi monitor
├── CLAUDE.md                 # AI strategy development guide
├── .env                      # Environment variables
└── package.json              # Dependencies
```

## 💡 Strategy Overview

### 🎯 4H Trend Filter (`timeframe_4h.pine`)

Determines the market regime using three indicators:

| Regime | Condition |
|--------|-----------|
| **AllowLong** | ADX > 25, MACD histogram > 0, DI+ > DI-, RSI > 50 |
| **AllowShort** | ADX > 25, MACD histogram < 0, DI- > DI+, RSI < 50 |
| **AllowBoth** | Strong trend but no clear bull/bear regime |
| **NoTrades** | ADX ≤ 25 (weak trend) |

### ⚡ 15m Signal Generator (`timeframe_15m.pine`)

Generates entry signals with EMA crossover confirmed by volume and momentum:

- **Long**: EMA(5) crosses above EMA(13), RSI 40–65, price above EMA(50), volume spike (>1.5x MA), positive momentum
- **Short**: EMA(5) crosses below EMA(13), RSI 35–60, price below EMA(50), volume spike, negative momentum
- **SL/TP**: Static 2%/3% from entry price
- **Signal expiry**: 5 bars

### 🛡️ Risk Filters

- Reject signals where SL distance < 0.2% (slippage protection)
- Reject signals where TP distance < 0.2% (slippage protection)
- Trend alignment: long signals rejected in bear regime, short signals rejected in bull regime

### 💹 Position Management

- **Partial profit taking**: Scale out at 3 levels — 33% at TP3, 33% at TP2, 34% at TP1
- **Breakeven trailing stop**: When breakeven is reached, lower trailing stop by 3 points

## 🕐 Backtest Frames

| Frame | Period | Market Note |
|-------|--------|-------------|
| `February2024` | Feb 1–29, 2024 | Bull run |
| `October2025` | Oct 1–31, 2025 | Sharp drop Oct 9–11 |
| `November2025` | Nov 1–30, 2025 | Sideways with downtrend |
| `December2025` | Dec 1–31, 2025 | Sideways, no clear direction |

## 💡 CLI Options

```bash
# Create project with custom name
npx -y @backtest-kit/sidekick my-bot

# Create in current directory (must be empty)
npx -y @backtest-kit/sidekick .
```

## 📋 Dependencies

| Package | Purpose |
|---------|---------|
| [backtest-kit](https://libraries.io/npm/backtest-kit) | Core backtesting/trading framework |
| [@backtest-kit/pinets](https://github.com/QuantForgeOrg/PineTS) | Pine Script v5 runtime for Node.js |
| [@backtest-kit/ui](https://libraries.io/npm/backtest-kit) | Interactive charting dashboard |
| [@backtest-kit/ollama](https://libraries.io/npm/backtest-kit) | LLM inference integration |
| [ccxt](https://github.com/ccxt/ccxt) | Binance exchange connectivity |
| [functools-kit](https://www.npmjs.com/package/functools-kit) | `singleshot`, `randomString` utilities |
| [pinolog](https://www.npmjs.com/package/pinolog) | File-based structured logging |
| [openai](https://www.npmjs.com/package/openai) | OpenAI API client |
| [ollama](https://www.npmjs.com/package/ollama) | Ollama local LLM client |

## 🔗 Links

- [Backtest Kit Documentation](https://backtest-kit.github.io/documents/example_02_first_backtest.html)
- [GitHub Repository](https://github.com/tripolskypetr/backtest-kit)
- [Demo Projects](https://github.com/tripolskypetr/backtest-kit/tree/master/demo)
- [API Reference](https://backtest-kit.github.io/documents/example_02_first_backtest.html)

## 🤝 Contribute

Found a bug or want to add a feature? [Open an issue](https://github.com/tripolskypetr/backtest-kit/issues) or submit a PR!

## 📜 License

MIT © [tripolskypetr](https://github.com/tripolskypetr)
