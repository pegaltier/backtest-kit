# Backtest Kit

A powerful TypeScript framework for backtesting trading strategies with clean architecture and real-time execution capabilities.

## Features

- 🚀 **Clean Architecture** - Separation of concerns with DI container
- 📊 **Strategy Backtesting** - Test your trading strategies on historical data
- 🔄 **Real-time Execution** - Run strategies live with configurable intervals
- 📈 **VWAP Pricing** - Volume-weighted average price calculation
- 🎯 **Signal Management** - Automatic signal lifecycle (open/close) with TP/SL
- 📉 **PNL Calculation** - Accurate profit/loss with fees and slippage
- 📝 **Beautiful Reports** - Markdown tables with statistics
- 🔌 **Flexible Schema** - Plug your own data sources

## Installation

```bash
npm install
```

## Quick Start

### 1. Add Data Source (Exchange)

```typescript
import { addExchange } from "./src/function/add";

addExchange({
  getCandles: async (symbol, interval, since, limit) => {
    // Fetch candle data from your source (exchange API, database, etc.)
    return [
      {
        timestamp: Date.now(),
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 1000,
      },
    ];
  },
});
```

### 2. Add Strategy

```typescript
import { addStrategy } from "./src/function/add";

addStrategy({
  getSignal: async (symbol) => {
    // Your signal generation logic
    return {
      id: "signal-1",
      position: "long",
      note: "BTC breakout",
      priceOpen: 50000,
      priceTakeProfit: 51000,
      priceStopLoss: 49000,
      minuteEstimatedTime: 60,
      timestamp: Date.now(),
    };
  },
  callbacks: {
    onOpen: (backtest, symbol, data) => {
      console.log("Signal opened:", data);
    },
    onClose: (backtest, symbol, priceClose, data) => {
      console.log("Signal closed at:", priceClose);
    },
  },
});
```

### 3. Run Backtest

```typescript
import { runBacktest, runBacktestGUI } from "./src/function/backtest";

// Generate timeframes (every minute for 24 hours)
const timeframes = Array.from({ length: 1440 }, (_, i) => {
  const date = new Date("2024-01-01T00:00:00Z");
  date.setMinutes(date.getMinutes() + i);
  return date;
});

// Simple backtest (returns data only)
const result = await runBacktest("BTCUSDT", timeframes);
console.log(result.results); // Array of closed trades with PNL

// Backtest with terminal output
runBacktestGUI("BTCUSDT", timeframes);
// Prints beautiful ASCII table to console
```

**Terminal Output:**

```
┌───┬──────────────────────────┬────────────┬───────────┬────────────┬──────────┐
│ # │ Time                     │ Note       │ Price     │ Reason     │ PNL %    │
├───┼──────────────────────────┼────────────┼───────────┼────────────┼──────────┤
│ 1 │ 2024-01-01T00:05:00.000Z │ BTC Long   │ 51000.00  │ take_profit│ 🟢 +1.98%│
│ 2 │ 2024-01-01T01:30:00.000Z │ BTC Short  │ 50800.00  │ stop_loss  │ 🔴 -0.42%│
├───┼──────────────────────────┼────────────┼───────────┼────────────┼──────────┤
│   │                          │            │           │            │          │
├───┼──────────────────────────┼────────────┼───────────┼────────────┼──────────┤
│TOTAL│ 2 trades               │ Win: 1     │ Loss: 1   │ -          │ +1.56%   │
└───┴──────────────────────────┴────────────┴───────────┴────────────┴──────────┘
```

### 4. Real-time Execution

```typescript
import { startRun, stopRun, stopAll } from "./src/function/run";

// Start strategy for multiple symbols
startRun({ symbol: "BTCUSDT", interval: 5 * 60 * 1000 }); // 5 minutes
startRun({ symbol: "ETHUSDT", interval: 5 * 60 * 1000 });

// Stop specific symbol
stopRun("BTCUSDT");

// Stop all
stopAll();
```

### 5. Advanced: Reduce Pattern

Use the reduce pattern to iterate timeframes with custom logic:

```typescript
import { reduce } from "./src/function/reduce";

interface Context {
  count: number;
  timestamps: Date[];
  apiCalls: number;
}

const result = await reduce<Context>(
  "BTCUSDT",
  timeframes,
  async (acc, index, when, symbol) => {
    acc.count++;
    acc.timestamps.push(when);

    // Make your custom API calls, LLM requests, etc.
    const response = await fetch(`/api/analyze?symbol=${symbol}&when=${when}`);
    acc.apiCalls++;

    return acc;
  },
  { count: 0, timestamps: [], apiCalls: 0 }
);

// Use accumulated data
console.log(result.accumulator);
// { count: 1440, timestamps: [...], apiCalls: 1440 }
```

## Architecture

```
src/
├── function/          # High-level API functions
│   ├── add.ts        # Add schemas (strategy, exchange)
│   ├── backtest.ts   # Backtesting functions
│   ├── reduce.ts     # Reduce pattern for accumulation
│   ├── run.ts        # Real-time execution
│   └── exchange.ts   # Exchange data functions
├── client/           # Client implementations
│   ├── ClientExchange.ts  # Exchange client with VWAP
│   └── ClientStrategy.ts  # Strategy client with signal lifecycle
├── interfaces/       # TypeScript interfaces
│   ├── Strategy.interface.ts
│   └── Exchange.interface.ts
└── lib/             # Core library with DI
    ├── core/        # Dependency injection
    └── services/    # Services (schema, connection, public)
```

## Configuration

### Fee and Slippage

Configured in `src/interfaces/Strategy.interface.ts`:

```typescript
export const PERCENT_SLIPPAGE = 0.1; // 0.1%
export const PERCENT_FEE = 0.1; // 0.1%
```

### Signal Close Reasons

- `time_expired` - Signal duration exceeded
- `take_profit` - Take profit target reached
- `stop_loss` - Stop loss triggered

## API Reference

### Functions

#### `addExchange(exchangeSchema: IExchangeSchema)`
Add exchange data source for candles.

#### `addStrategy(strategySchema: IStrategySchema)`
Add trading strategy.

#### `getCandles(symbol, interval, limit): Promise<ICandleData[]>`
Get candle data from exchange.

#### `getAveragePrice(symbol): Promise<number>`
Get VWAP average price based on last 5 1m candles.

#### `runBacktest(symbol: string, timeframes: Date[]): Promise<IBacktestResult>`
Run backtest and return closed trades only.

#### `runBacktestGUI(symbol: string, timeframes: Date[]): void`
Run backtest and print beautiful ASCII table to terminal.

#### `reduce<T>(symbol, timeframes, callback, initialValue): Promise<IReduceResult<T>>`
Iterate timeframes with accumulator pattern. Callback receives `(accumulator, index, when, symbol)`.

#### `startRun(config: IRunConfig)`
Start real-time strategy execution.

#### `stopRun(symbol: string)`
Stop specific symbol execution.

#### `stopAll()`
Stop all running strategies.

## Types

### Signal Data

```typescript
interface ISignalData {
  id: string;
  position: "long" | "short";
  note: string;
  priceOpen: number;
  priceTakeProfit: number;
  priceStopLoss: number;
  minuteEstimatedTime: number;
  timestamp: number;
}
```

### Tick Results

```typescript
type IStrategyTickResult =
  | IStrategyTickResultIdle      // No active signal
  | IStrategyTickResultOpened    // Signal just opened
  | IStrategyTickResultActive    // Signal is active
  | IStrategyTickResultClosed;   // Signal closed with PNL
```

## Use Cases

The reduce pattern is perfect for:
- **LLM Integration** - Feed historical data to AI models for analysis
- **Custom Analytics** - Build your own metrics and statistics
- **API Aggregation** - Collect data from multiple sources over time
- **Data Processing** - Transform and accumulate timeframe data
- **Real-time Trading** - Use `startRun` for live strategy execution

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first.
