---
title: docs/function/cancel
group: docs
---

# cancel

```ts
declare function cancel(symbol: string, strategyName: StrategyName, cancelId?: string): Promise<void>;
```

Cancels the scheduled signal without stopping the strategy.

Clears the scheduled signal (waiting for priceOpen activation).
Does NOT affect active pending signals or strategy operation.
Does NOT set stop flag - strategy can continue generating new signals.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
| `strategyName` | Strategy name |
| `cancelId` | Optional cancellation ID for tracking user-initiated cancellations |
