---
title: docs/class/BrokerBase
group: docs
---

# BrokerBase

Implements `IBroker`

Base class for custom broker adapter implementations.

Provides default no-op implementations for all IBroker methods that log events.
Extend this class to implement a real exchange adapter for:
- Placing and canceling limit/market orders
- Updating stop-loss and take-profit levels on exchange
- Tracking position state in an external system
- Sending trade notifications (Telegram, Discord, Email)
- Recording trades to a database or analytics service

Key features:
- All methods have default implementations (no need to override unused methods)
- Automatic logging of all events via bt.loggerService
- Implements the full IBroker interface
- `makeExtendable` applied for correct subclass instantiation

Lifecycle:
1. Constructor called (no arguments)
2. `waitForInit()` called once for async initialization (e.g. exchange login)
3. Event methods called as strategy executes
4. No explicit dispose — clean up in `waitForInit` teardown or externally

Event flow (called only in live mode, skipped in backtest):
- `onSignalOpenCommit` — new position opened
- `onSignalCloseCommit` — position closed (SL/TP hit or manual close)
- `onPartialProfitCommit` — partial close at profit executed
- `onPartialLossCommit` — partial close at loss executed
- `onTrailingStopCommit` — trailing stop-loss updated
- `onTrailingTakeCommit` — trailing take-profit updated
- `onBreakevenCommit` — stop-loss moved to entry price
- `onAverageBuyCommit` — new DCA entry added to position

## Constructor

```ts
constructor();
```

## Methods

### waitForInit

```ts
waitForInit(): Promise<void>;
```

Performs async initialization before the broker starts receiving events.

Called once by BrokerProxy via `waitForInit()` (singleshot) before the first event.
Override to establish exchange connections, authenticate API clients, load configuration.

Default implementation: Logs initialization event.

### onSignalOpenCommit

```ts
onSignalOpenCommit(payload: BrokerSignalOpenPayload): Promise<void>;
```

Called when a new position is opened (signal activated).

Triggered automatically via syncSubject when a scheduled signal's priceOpen is hit.
Use to place the actual entry order on the exchange.

Default implementation: Logs signal-open event.

### onSignalCloseCommit

```ts
onSignalCloseCommit(payload: BrokerSignalClosePayload): Promise<void>;
```

Called when a position is fully closed (SL/TP hit or manual close).

Triggered automatically via syncSubject when a pending signal is closed.
Use to place the exit order and record final PnL.

Default implementation: Logs signal-close event.

### onPartialProfitCommit

```ts
onPartialProfitCommit(payload: BrokerPartialProfitPayload): Promise<void>;
```

Called when a partial close at profit is executed.

Triggered explicitly from strategy.ts / Live.ts / Backtest.ts after all validations pass,
before `strategyCoreService.partialProfit()`. If this method throws, the DI mutation is skipped.
Use to partially close the position on the exchange at the profit level.

Default implementation: Logs partial profit event.

### onPartialLossCommit

```ts
onPartialLossCommit(payload: BrokerPartialLossPayload): Promise<void>;
```

Called when a partial close at loss is executed.

Triggered explicitly from strategy.ts / Live.ts / Backtest.ts after all validations pass,
before `strategyCoreService.partialLoss()`. If this method throws, the DI mutation is skipped.
Use to partially close the position on the exchange at the loss level.

Default implementation: Logs partial loss event.

### onTrailingStopCommit

```ts
onTrailingStopCommit(payload: BrokerTrailingStopPayload): Promise<void>;
```

Called when the trailing stop-loss level is updated.

Triggered explicitly after all validations pass, before `strategyCoreService.trailingStop()`.
`newStopLossPrice` is the absolute SL price — use it to update the exchange order directly.

Default implementation: Logs trailing stop event.

### onTrailingTakeCommit

```ts
onTrailingTakeCommit(payload: BrokerTrailingTakePayload): Promise<void>;
```

Called when the trailing take-profit level is updated.

Triggered explicitly after all validations pass, before `strategyCoreService.trailingTake()`.
`newTakeProfitPrice` is the absolute TP price — use it to update the exchange order directly.

Default implementation: Logs trailing take event.

### onBreakevenCommit

```ts
onBreakevenCommit(payload: BrokerBreakevenPayload): Promise<void>;
```

Called when the stop-loss is moved to breakeven (entry price).

Triggered explicitly after all validations pass, before `strategyCoreService.breakeven()`.
`newStopLossPrice` equals `effectivePriceOpen` — the position's effective entry price.
`newTakeProfitPrice` is unchanged by breakeven.

Default implementation: Logs breakeven event.

### onAverageBuyCommit

```ts
onAverageBuyCommit(payload: BrokerAverageBuyPayload): Promise<void>;
```

Called when a new DCA entry is added to the active position.

Triggered explicitly after all validations pass, before `strategyCoreService.averageBuy()`.
`currentPrice` is the market price at which the new averaging entry is placed.
`cost` is the dollar amount of the new DCA entry.

Default implementation: Logs average buy event.
