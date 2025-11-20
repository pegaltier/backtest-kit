# Architecture

## Overview

Backtest-kit is a TypeScript framework for backtesting and live trading strategies. The architecture follows clean architecture principles with dependency injection, separation of concerns, and type-safe discriminated unions.

## Core Concepts

### 1. Signal Lifecycle

Signals have a strict lifecycle managed through discriminated union types:

- **idle** - No active signal
- **opened** - Signal just created with TP/SL/ETA parameters
- **active** - Signal is monitoring for TP/SL conditions
- **closed** - Signal completed with reason (time_expired | take_profit | stop_loss)

### 2. Execution Modes

The framework supports two execution modes:

- **Backtest Mode** (`backtest: true`) - Simulates trading with historical data
- **Live Mode** (`backtest: false`) - Real-time strategy execution

### 3. Price Calculation

All price calculations use **VWAP (Volume Weighted Average Price)**:
```typescript
const typicalPrice = (high + low + close) / 3;
const vwap = sumPriceVolume / totalVolume;
```

Uses last 5 1-minute candles for all entry/exit decisions.

## Architecture Layers

### Client Layer (`src/client/`)

Client classes implement business logic without DI dependencies:

- **ClientStrategy** - Signal lifecycle management
  - `tick()` - Real-time monitoring with VWAP checks
  - `backtest(candles)` - Fast backtest using candle array

- **ClientExchange** - Candle data access
  - `getCandles()` - Historical candles (backward from `when`)
  - `getNextCandles()` - Future candles (forward from `when`)
  - `getAveragePrice()` - VWAP from last 5 candles

- **ClientFrame** - Timeframe generation
  - `getTimeframe()` - Generate Date[] array for iteration

### Service Layer (`src/lib/services/`)

Services use DI and are organized by responsibility:

#### Connection Services (`connection/`)
Create and memoize client instances:
- `StrategyConnectionService` - ClientStrategy instances
- `ExchangeConnectionService` - ClientExchange instances
- `FrameConnectionService` - ClientFrame instances

#### Public Services (`public/`)
Wrap connection services with ExecutionContext:
- `StrategyPublicService` - tick(symbol, when, backtest), backtest(symbol, candles, when, backtest)
- `ExchangePublicService` - getCandles(), getNextCandles(), getAveragePrice()
- `FramePublicService` - getTimeframe(symbol)

#### Schema Services (`schema/`)
Registry pattern for configuration using `ToolRegistry`:
- `StrategySchemaService` - Strategy schemas (strategyName → IStrategySchema)
- `ExchangeSchemaService` - Exchange schemas (exchangeName → IExchangeSchema)
- `FrameSchemaService` - Frame schemas (frameName → IFrameSchema)

Methods: `register(key, value)`, `override(key, partial)`, `get(key)`

#### Logic Services (`logic/`)
High-level business logic orchestration:

- **BacktestLogicService** - Smart backtest execution
  - Iterates timeframes with `while` loop
  - Calls `tick()` to detect signal open
  - When opened: fetches `minuteEstimatedTime` candles and calls `backtest()`
  - Skips timeframes until `closeTimestamp` after signal closes
  - Returns only `IStrategyTickResultClosed[]`

- **LiveLogicService** - Real-time execution (empty placeholder)

#### Context Services (`context/`)

Two scoped context providers using `di-scoped`:

**ExecutionContextService** - Trading context:
```typescript
interface IExecutionContext {
  symbol: string;
  when: Date;
  backtest: boolean;
}
```

**MethodContextService** - Schema selection context:
```typescript
interface IExecutionContext {
  exchangeName: ExchangeName;
  strategyName: StrategyName;
  frameName: FrameName;
}
```

## Data Flow

### Backtest Flow

```
User
  → BacktestLogicService.run(symbol, timeframes[])
    → MethodContextService.runInContext (set strategyName, exchangeName)
      → Loop: timeframes[i]
        → StrategyPublicService.tick(symbol, when, true)
          → ExecutionContextService.runInContext (set symbol, when, backtest)
            → StrategyConnectionService.tick()
              → ClientStrategy.tick()
                → ExchangeConnectionService.getAveragePrice() (VWAP)
                → Check TP/SL conditions
                → Return: opened | active | closed

        → If opened:
          → ExchangePublicService.getNextCandles(symbol, "1m", signal.minuteEstimatedTime, when, true)
            → ClientExchange.getNextCandles()

          → StrategyPublicService.backtest(symbol, candles, when, true)
            → ClientStrategy.backtest(candles)
              → For each candle: calculate VWAP from last 5 candles
              → Check TP/SL on each VWAP
              → Return: closed (always)

          → Skip timeframes until closeTimestamp

      → Return: IStrategyTickResultClosed[]
```

### Live Flow

```
User
  → StrategyPublicService.tick(symbol, when, false)
    → ExecutionContextService.runInContext
      → StrategyConnectionService.tick()
        → ClientStrategy.tick()
          → Real-time VWAP check
          → Return: idle | opened | active | closed
```

## Key Design Patterns

### 1. Discriminated Unions

All results use discriminated unions for type safety:

```typescript
type IStrategyTickResult =
  | IStrategyTickResultIdle
  | IStrategyTickResultOpened
  | IStrategyTickResultActive
  | IStrategyTickResultClosed;

type IStrategyBacktestResult = IStrategyTickResultClosed;
```

No optional fields (`?:`), all fields are required.

### 2. Dependency Injection

Uses custom DI container with:
- `provide(symbol, factory)` - Register service
- `inject<T>(symbol)` - Resolve service
- `TYPES` object with Symbol keys

### 3. Memoization

Client instances are memoized by key:
```typescript
getStrategy = memoize(
  (strategyName) => `${strategyName}`,
  (strategyName) => new ClientStrategy(...)
);
```

### 4. Context Propagation

Nested contexts using `di-scoped`:
```typescript
ExecutionContextService.runInContext(
  async () => {
    return await MethodContextService.runInContext(
      async () => { /* logic */ },
      { exchangeName, strategyName, frameName }
    );
  },
  { symbol, when, backtest }
);
```

Public services handle ExecutionContext automatically, so users don't need to wrap calls manually.

### 5. Registry Pattern

Schema services use `ToolRegistry` from functools-kit:
```typescript
strategySchemaService.register("my-strategy", schema);
const schema = strategySchemaService.get("my-strategy");
```

## Signal Closing Logic

### In `tick()` mode:
- Checks if `when >= signal.timestamp + minuteEstimatedTime * 60 * 1000`
- Checks VWAP against TP/SL every tick
- Returns `closeTimestamp` from `execution.context.when`

### In `backtest()` mode:
- Receives `candles[]` for `minuteEstimatedTime` minutes
- Iterates from index 4 (needs 5 candles for VWAP)
- Calculates VWAP from last 5 candles on each iteration
- Returns `closeTimestamp` from candle timestamp
- Always returns `closed` (either TP/SL or time_expired)

## PNL Calculation

Located in `src/helpers/toProfitLossDto.ts`:

```typescript
// Constants
PERCENT_SLIPPAGE = 0.1%
PERCENT_FEE = 0.1%

// LONG position
priceOpenWithCosts = priceOpen * (1 + slippage + fee)
priceCloseWithCosts = priceClose * (1 - slippage - fee)
pnl% = (priceCloseWithCosts - priceOpenWithCosts) / priceOpenWithCosts * 100

// SHORT position
priceOpenWithCosts = priceOpen * (1 - slippage + fee)
priceCloseWithCosts = priceClose * (1 + slippage + fee)
pnl% = (priceOpenWithCosts - priceCloseWithCosts) / priceOpenWithCosts * 100
```

## File Structure

```
src/
├── client/           # Pure business logic (no DI)
│   ├── ClientStrategy.ts
│   ├── ClientExchange.ts
│   └── ClientFrame.ts
├── lib/
│   ├── core/        # DI container
│   │   ├── di.ts
│   │   ├── provide.ts
│   │   └── types.ts
│   ├── services/
│   │   ├── base/         # LoggerService
│   │   ├── context/      # ExecutionContext, MethodContext
│   │   ├── connection/   # Client instance creators
│   │   ├── public/       # Context wrappers
│   │   ├── schema/       # Registry services
│   │   └── logic/        # Business orchestration
│   └── index.ts     # Public API
├── interfaces/      # TypeScript interfaces
│   ├── Strategy.interface.ts
│   ├── Exchange.interface.ts
│   └── Frame.interface.ts
├── function/        # High-level functions
│   ├── backtest.ts  # runBacktest, runBacktestGUI
│   ├── run.ts       # startRun, stopRun
│   ├── reduce.ts    # Accumulator pattern
│   ├── add.ts       # addStrategy, addExchange
│   └── exchange.ts  # getCandles, getAveragePrice
└── helpers/         # Utilities
    └── toProfitLossDto.ts
```

## Naming Conventions

- **Candle** → **Exchange** (historical rename, preserved `ICandleData`)
- Services: `<Name>Service` (e.g., `StrategyPublicService`)
- Interfaces: `I<Name>` (e.g., `IStrategySchema`)
- Types: `<Name>` (e.g., `StrategyName`, `ExchangeName`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `PERCENT_FEE`)
- Functions: `<verb><Noun>` (e.g., `addStrategy`, `getCandles`)

## Type Safety Rules

1. **No optional fields** - Use discriminated unions instead
2. **Required closeTimestamp** - All closed signals include timestamp
3. **Union types for states** - Never use nullable patterns
4. **Constants over strings** - Use `StrategyCloseReason` type
5. **Type guards in logic** - Use `result.action === "closed"` checks

## Performance Optimizations

1. **Memoization** - Client instances cached by schema name
2. **Fast backtest** - `backtest()` method skips individual ticks
3. **Timeframe skipping** - Jump to `closeTimestamp` after signal closes
4. **VWAP caching** - Calculated once per tick/candle
5. **Single-run pattern** - Prevents parallel execution conflicts

## Extension Points

Users can extend the framework by:

1. **Registering schemas**:
   ```typescript
   addStrategy(strategySchema);
   addExchange(exchangeSchema);
   ```

2. **Implementing callbacks**:
   ```typescript
   callbacks: {
     onOpen: (backtest, symbol, signal) => {},
     onClose: (backtest, symbol, priceClose, signal) => {}
   }
   ```

3. **Custom reduce logic**:
   ```typescript
   reduce(symbol, timeframes, (acc, index, when, symbol) => {
     // Custom accumulation
   }, initialValue);
   ```

## Testing Strategy

The architecture separates concerns for testability:

- **Client classes** - Pure functions, easy to unit test
- **Connection services** - Memoization can be tested
- **Public services** - Context injection can be mocked
- **Logic services** - Integration tests with mock schemas

## Future Considerations

- **Multi-symbol support** - Already implemented in `run.ts` with `Map<string, IRunInstance>`
- **Frame integration** - Frame services ready, not yet used in backtest
- **Live trading** - LiveLogicService placeholder for real execution
- **Portfolio management** - Can track multiple strategies via callbacks
- **Risk management** - Can be added as a service layer
