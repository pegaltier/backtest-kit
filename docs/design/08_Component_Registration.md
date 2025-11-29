# Component Registration


## Purpose and Scope

This page explains how to register components in backtest-kit using the `add*` family of functions. Component registration is the first step in using the framework—you define strategies, exchanges, frames, risk profiles, sizing configurations, and walkers before running backtests or live trading.

For information about the structure and properties of each component type, see [Component Types](./23_Component_Types.md). For details on how registered components are instantiated during execution, see [Connection Services](./38_Connection_Services.md).

---

## Component Types Overview

The framework supports six types of components that can be registered:

| Component Type | Add Function | Purpose | Required For |
|---|---|---|---|
| **Strategy** | `addStrategy()` | Signal generation logic and lifecycle callbacks | Backtest, Live |
| **Exchange** | `addExchange()` | Market data source and price/quantity formatting | Backtest, Live, Walker |
| **Frame** | `addFrame()` | Backtest timeframe generation (start/end dates, interval) | Backtest, Walker |
| **Risk** | `addRisk()` | Portfolio-level risk management and custom validations | Optional (strategy-level) |
| **Sizing** | `addSizing()` | Position size calculation methods | Optional (strategy-level) |
| **Walker** | `addWalker()` | Multi-strategy comparison configuration | Walker mode only |

Each component is identified by a unique name (`strategyName`, `exchangeName`, etc.) and stored in a corresponding schema service.


---

## Registration Functions

### Function Signatures

All registration functions follow the same pattern: accept a schema object and store it in the framework's internal registry.

![Mermaid Diagram](./diagrams/08_Component_Registration_0.svg)

**Diagram: Registration Function Flow**


### addStrategy

Registers a trading strategy with signal generation logic and lifecycle callbacks.

**Parameters:**
- `strategyName`: Unique identifier (string)
- `interval`: Signal generation throttle interval (`SignalInterval`)
- `getSignal`: Async function returning `ISignalDto | null`
- `callbacks`: Optional lifecycle hooks (`onTick`, `onOpen`, `onClose`, `onSchedule`, `onCancel`)
- `riskName`: Optional risk profile name to use
- `sizingName`: Optional sizing configuration name to use

**Example:**
```typescript
addStrategy({
  strategyName: "momentum-breakout",
  interval: "5m",
  getSignal: async (symbol) => ({
    position: "long",
    priceOpen: 50000,
    priceTakeProfit: 51000,
    priceStopLoss: 49000,
    minuteEstimatedTime: 60,
  }),
  riskName: "conservative",
  callbacks: {
    onOpen: (symbol, signal, price, backtest) => {
      console.log(`[${symbol}] Signal opened at ${price}`);
    },
  },
});
```


### addExchange

Registers a market data source with candle fetching and formatting functions.

**Parameters:**
- `exchangeName`: Unique identifier (string)
- `getCandles`: Async function fetching `ICandleData[]`
- `formatPrice`: Async function formatting prices for exchange precision
- `formatQuantity`: Async function formatting quantities for exchange precision
- `callbacks`: Optional `onCandleData` callback

**Example:**
```typescript
addExchange({
  exchangeName: "binance",
  getCandles: async (symbol, interval, since, limit) => {
    // Fetch from API or database
    return [...];
  },
  formatPrice: async (symbol, price) => price.toFixed(2),
  formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
});
```


### addFrame

Registers a backtest timeframe with start/end dates and interval.

**Parameters:**
- `frameName`: Unique identifier (string)
- `interval`: Timeframe granularity (`FrameInterval`)
- `startDate`: Backtest period start (Date)
- `endDate`: Backtest period end (Date)
- `callbacks`: Optional `onTimeframe` callback

**Example:**
```typescript
addFrame({
  frameName: "2024-q1",
  interval: "1m",
  startDate: new Date("2024-01-01T00:00:00Z"),
  endDate: new Date("2024-03-31T23:59:59Z"),
});
```


### addRisk

Registers a risk management profile with custom validations.

**Parameters:**
- `riskName`: Unique identifier (string)
- `validations`: Array of `IRiskValidation` or `IRiskValidationFn`
- `callbacks`: Optional `onRejected` and `onAllowed` callbacks

**Example:**
```typescript
addRisk({
  riskName: "conservative",
  validations: [
    {
      validate: async ({ activePositionCount }) => {
        if (activePositionCount >= 5) {
          throw new Error("Max 5 concurrent positions");
        }
      },
      note: "Portfolio-level position limit",
    },
  ],
});
```


### addSizing

Registers a position sizing configuration (fixed-percentage, kelly-criterion, or atr-based).

**Parameters:**
- `sizingName`: Unique identifier (string)
- `method`: Sizing method discriminator
- Method-specific parameters (see [Sizing Schemas](./28_Sizing_Schemas.md))

**Example:**
```typescript
addSizing({
  sizingName: "fixed-1pct",
  method: "fixed-percentage",
  riskPercentage: 1,
  maxPositionPercentage: 10,
});
```


### addWalker

Registers a walker for multi-strategy comparison.

**Parameters:**
- `walkerName`: Unique identifier (string)
- `exchangeName`: Exchange to use for all backtests
- `frameName`: Frame to use for all backtests
- `strategies`: Array of strategy names to compare
- `metric`: Optimization metric (`WalkerMetric`)

**Example:**
```typescript
addWalker({
  walkerName: "strategy-optimizer",
  exchangeName: "binance",
  frameName: "2024-q1",
  strategies: ["momentum-v1", "momentum-v2", "momentum-v3"],
  metric: "sharpeRatio",
});
```


---

## Registration Flow

### Internal Mechanics

When a component is registered via an `add*` function, the framework performs two operations:

1. **Validation**: Schema is validated and stored in a validation service
2. **Registration**: Schema is stored in a schema service for later retrieval

![Mermaid Diagram](./diagrams/08_Component_Registration_1.svg)

**Diagram: Registration Sequence**

Each `add*` function follows this pattern in [src/function/add.ts:50-341]():

```typescript
export function addStrategy(strategySchema: IStrategySchema) {
  // 1. Log registration
  backtest.loggerService.info(ADD_STRATEGY_METHOD_NAME, {
    strategySchema,
  });
  
  // 2. Validate schema
  backtest.strategyValidationService.addStrategy(
    strategySchema.strategyName,
    strategySchema
  );
  
  // 3. Store in registry
  backtest.strategySchemaService.register(
    strategySchema.strategyName,
    strategySchema
  );
}
```


---

## Schema Storage Architecture

### Service Layer Organization

Registered schemas are stored in schema services that follow the ToolRegistry pattern. Each component type has a dedicated schema service:

![Mermaid Diagram](./diagrams/08_Component_Registration_2.svg)

**Diagram: Schema Service Architecture**

The dependency injection configuration is defined in:
- Symbol definitions: [src/lib/core/types.ts:18-25]()
- Service binding: [src/lib/core/provide.ts:62-68]()
- Service injection: [src/lib/index.ts:80-91]()


### ToolRegistry Pattern

Schema services use the ToolRegistry pattern for name-based storage and retrieval:

| Method | Purpose |
|---|---|
| `register(name, schema)` | Store schema by unique name |
| `get(name)` | Retrieve schema by name (throws if not found) |
| `has(name)` | Check if schema exists |
| `list()` | Get all registered schemas |

This pattern enables:
- **Name-based lookup**: Components retrieved by string identifier during execution
- **Duplicate prevention**: Registration fails if name already exists
- **Runtime introspection**: All schemas can be listed for debugging


---

## Validation Layer

### Validation Services

Each component type has a corresponding validation service that performs schema validation during registration:

![Mermaid Diagram](./diagrams/08_Component_Registration_3.svg)

**Diagram: Validation Layer**

Validation services are bound in the DI container:
- Symbol definitions: [src/lib/core/types.ts:59-66]()
- Service binding: [src/lib/core/provide.ts:103-109]()
- Service injection: [src/lib/index.ts:143-150]()

### Memoization

Validation services use memoization to cache validation results per component name. This ensures validation only runs once per component, even if the schema is retrieved multiple times during execution.


---

## Component Introspection

### List Functions

The framework provides `list*` functions for runtime introspection of registered components:

| Function | Returns | Purpose |
|---|---|---|
| `listStrategies()` | `Promise<IStrategySchema[]>` | All registered strategies |
| `listExchanges()` | `Promise<IExchangeSchema[]>` | All registered exchanges |
| `listFrames()` | `Promise<IFrameSchema[]>` | All registered frames |
| `listRisks()` | `Promise<IRiskSchema[]>` | All registered risk profiles |
| `listSizings()` | `Promise<ISizingSchema[]>` | All registered sizing configs |
| `listWalkers()` | `Promise<IWalkerSchema[]>` | All registered walkers |

**Example:**
```typescript
import { addStrategy, listStrategies } from "backtest-kit";

addStrategy({
  strategyName: "momentum",
  interval: "5m",
  getSignal: async (symbol) => ({ /* ... */ }),
});

const strategies = await listStrategies();
console.log(strategies);
// [{ strategyName: "momentum", interval: "5m", ... }]
```

These functions delegate to the validation services' `list()` method, which returns all schemas stored in the registry.


---

## Registration and Execution Lifecycle

### Timeline Overview

The relationship between registration and execution follows this sequence:

![Mermaid Diagram](./diagrams/08_Component_Registration_4.svg)

**Diagram: Registration to Execution Lifecycle**

Key points:
1. **Registration phase** (user calls `add*`): Schemas validated and stored
2. **Ready phase**: No client instances created, schemas in memory
3. **Execution phase** (user calls `Backtest.run` or `Live.run`): Connection services retrieve schemas and create memoized client instances

For details on client instantiation, see [Connection Services](./38_Connection_Services.md). For execution orchestration, see [Execution Modes](./06_Execution_Modes.md).


---

## Symbol-Based Dependency Injection

### DI Token System

All schema services and validation services are bound using Symbol-based tokens in the DI container. This prevents naming collisions and provides type safety:

![Mermaid Diagram](./diagrams/08_Component_Registration_5.svg)

**Diagram: Symbol-Based DI Token Flow**

The complete DI setup is defined across three files:
1. Token symbols: [src/lib/core/types.ts:1-81]()
2. Service binding: [src/lib/core/provide.ts:1-111]()
3. Service injection: [src/lib/index.ts:1-170]()
