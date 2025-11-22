# Backtest & Live Trading (v1.1.1, 22/11/2025)

> Github [release link](https://github.com/tripolskypetr/backtest-kit/releases/tag/1.1.1)

Build robust trading systems with crash-safe state persistence and event-driven architecture! 🚀 Test strategies on historical data or deploy to production with automatic recovery. 💾 Type-safe signal lifecycle prevents invalid trades with comprehensive validation. ✅ Memory-optimized async generators stream execution for backtest and live modes. 🔄 Event emitters provide real-time notifications for signals, errors, and completion. 🔔 Generate markdown reports with win rate and PNL statistics automatically. 📊

```typescript
import {
  addExchange,
  addStrategy,
  addFrame,
  Backtest,
  Live,
  listenSignalBacktest,
  listenSignalLive,
  listenError,
  listenDone,
} from "backtest-kit";

// Register exchange with CCXT
addExchange({
  exchangeName: "binance",
  getCandles: async (symbol, interval, since, limit) => {
    const exchange = new ccxt.binance();
    const ohlcv = await exchange.fetchOHLCV(symbol, interval, since.getTime(), limit);
    return ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp, open, high, low, close, volume,
    }));
  },
  formatPrice: async (symbol, price) => {
    const exchange = new ccxt.binance();
    return exchange.priceToPrecision(symbol, price);
  },
  formatQuantity: async (symbol, quantity) => {
    const exchange = new ccxt.binance();
    return exchange.amountToPrecision(symbol, quantity);
  },
});

// Register strategy
addStrategy({
  strategyName: "my-strategy",
  interval: "1m",
  getSignal: async ({ getCandles, getAveragePrice }) => {
    const candles = await getCandles("BTCUSDT", "1h", 100);
    const currentPrice = await getAveragePrice("BTCUSDT");

    // Your strategy logic here
    return {
      position: "long",
      note: "BTC breakout",
      priceOpen: currentPrice,
      priceTakeProfit: currentPrice * 1.02,
      priceStopLoss: currentPrice * 0.98,
      minuteEstimatedTime: 60,
      timestamp: Date.now(),
    };
  },
});

// Register timeframe for backtest
addFrame({
  frameName: "1d-backtest",
  interval: "1m",
  startDate: new Date("2024-01-01T00:00:00Z"),
  endDate: new Date("2024-01-02T00:00:00Z"),
});

// Run backtest in background
Backtest.background("BTCUSDT", {
  strategyName: "my-strategy",
  exchangeName: "binance",
  frameName: "1d-backtest"
});

// Listen to signals
listenSignalBacktest((event) => {
  if (event.action === "closed") {
    console.log("PNL:", event.pnl.pnlPercentage);
  }
});

// Listen to completion
listenDone((event) => {
  if (event.backtest) {
    console.log("Backtest completed:", event.symbol);
    Backtest.dump(event.strategyName); // ./logs/backtest/my-strategy.md
  }
});

// Listen to errors
listenError((error) => {
  console.error("Error:", error.message);
});
```
