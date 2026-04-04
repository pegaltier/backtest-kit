---
title: demo/exchange/readme
group: demo/exchange
---

# Exchange Schema Demo

> Link to [the source code](https://github.com/tripolskypetr/backtest-kit/tree/master/demo/exchange)

Reference implementation of a full `addExchangeSchema` setup using CCXT and Binance spot.

## Purpose

Demonstrates how to wire a real exchange into backtest-kit for:
- OHLCV candle fetching with proper timestamp handling
- Price and quantity formatting via market tick/step size
- Order book fetching (live only)
- Aggregated trade history fetching

## Key Features

- **Candle Fetching**: `fetchOHLCV` mapped to backtest-kit candle format
- **Price Formatting**: Tick-size-aware rounding via `roundTicks`
- **Quantity Formatting**: Step-size-aware rounding via `roundTicks`
- **Order Book**: Live order book via `fetchOrderBook` (backtest mode throws)
- **Aggregated Trades**: Historical trade data via Binance `publicGetAggTrades`
- **Singleton Exchange**: One CCXT instance reused across all calls via `singleshot`

## Technology Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: backtest-kit 6.5.0
- **Utilities**: functools-kit 1.0.95
- **Data Source**: ccxt 4.5.24 (Binance spot)

## Project Structure

```
demo/exchange/
├── src/
│   └── index.mjs   # Exchange schema registration and smoke test
├── package.json    # Dependencies and scripts
└── README.md       # This file
```

## Installation and Setup

```bash
# Navigate to project directory
cd demo/exchange

# Install dependencies
npm install

# Run the demo
npm start
```

## Usage Examples

### Basic Usage

Registers the exchange schema and fetches 5 candles for BTCUSDT/1m:

```bash
npm start
```

Output:
```javascript
[
  { timestamp: ..., open: ..., high: ..., low: ..., close: ..., volume: ... },
  ...
]
```

### Reusing the Schema in Your Project

Copy `addExchangeSchema` block from `src/index.mjs` into your own strategy file and reference it by name:

```javascript
import { Exchange } from "backtest-kit";

const candles = await Exchange.getCandles("ETHUSDT", "15m", 100, {
  exchangeName: "ccxt-exchange",
});
```

### Customizing the Exchange

Replace `ccxt.binance` with any other CCXT-supported exchange:

```javascript
const exchange = new ccxt.bybit({
  enableRateLimit: true,
});
```

## How It Works

### Exchange Initialization

A single Binance spot instance is created lazily via `singleshot` and reused across all calls:

```javascript
const getExchange = singleshot(async () => {
  const exchange = new ccxt.binance({ ... });
  await exchange.loadMarkets();
  return exchange;
});
```

### Price / Quantity Formatting

Uses market `limits` (tick size / step size) with `roundTicks` fallback to CCXT precision methods:

```javascript
const tickSize = market.limits?.price?.min || market.precision?.price;
return tickSize !== undefined
  ? roundTicks(price, tickSize)
  : exchange.priceToPrecision(symbol, price);
```

### Order Book

Returns normalized `{ asks, bids }` arrays with string price/quantity. Throws in backtest mode — implement your own snapshot replay if needed.

### Aggregated Trades

Uses Binance-specific `publicGetAggTrades` endpoint with `startTime`/`endTime` window.

## Related Libraries

The aggregated trades and candles fetched via this exchange schema can be fed directly into two companion analysis libraries.

### `garch` — Volatility Forecasting

Forecasts the expected price range for the next candle(s) using realized GARCH-family models. Auto-selects the best model (GARCH, EGARCH, GJR-GARCH, HAR-RV, NoVaS) by QLIKE error comparison.

```javascript
import { predict } from 'garch';

const candles = await Exchange.getCandles("BTCUSDT", "4h", 200, { exchangeName: "ccxt-exchange" });
const result = predict(candles, '4h');
// {
//   currentPrice: 97500,
//   sigma: 0.012,        // 1.2% per-period volatility
//   upperPrice: 98677,   // P·exp(+σ) — ceiling
//   lowerPrice: 96337,   // P·exp(-σ) — floor
//   modelType: 'egarch',
//   reliable: true
// }
```

Use `predictRange(candles, interval, steps)` for multi-candle swing trade corridors. Use `backtest(candles, interval)` for walk-forward validation of model accuracy.

**Confidence bands:**

| `confidence` | z | Typical use |
|---|---|---|
| `0.6827` (default) | 1.00 | Expected move, SL/TP targets |
| `0.95` | 1.96 | Risk management, position sizing |
| `0.99` | 2.58 | Stress testing, margin calculations |

See the [garch npm page](https://www.npmjs.com/package/garch) for the full API reference.

---

### `volume-anomaly` — Trade Flow Anomaly Detection

Detects abnormal surges in trade flow from a raw stream of aggregated trades. Three independent detectors run in parallel (Hawkes Process, CUSUM, Bayesian Online Changepoint Detection) and combine into a single `confidence` score.

```javascript
import { predict } from 'volume-anomaly';

// Fetch trades using getAggregatedTrades from the exchange schema
const all        = await Exchange.getAggregatedTrades("BTCUSDT", from, to, { exchangeName: "ccxt-exchange" });
const historical = all.slice(0, 1200);   // calibration baseline
const recent     = all.slice(1200);      // window to evaluate — no overlap

const result = predict(historical, recent, 0.75);
// {
//   anomaly:    true,
//   confidence: 0.83,
//   direction:  'long',   // 'long' | 'short' | 'neutral'
//   imbalance:  0.61,
// }
```

> Never overlap `historical` and `recent` — training absorbs any anomaly in the baseline and the detector learns to treat it as normal.

Use the stateful `VolumeAnomalyDetector` class for continuous monitoring (re-use fitted models across multiple `detect()` calls without re-training).

See the [volume-anomaly npm page](https://www.npmjs.com/package/volume-anomaly) for the full API reference.

---

## Dependencies

- [backtest-kit](https://github.com/tripolskypetr/backtest-kit) - Trading framework
- [functools-kit](https://www.npmjs.com/package/functools-kit) - Utility functions
- [garch](https://github.com/tripolskypetr/garch) - Volatility forecasting models
- [volume-anomaly](https://github.com/tripolskypetr/volume-anomaly) - Trade flow anomaly detection

## License

MIT © [tripolskypetr](https://github.com/tripolskypetr)
