---
title: docs/function/stop
group: docs
---

# stop

```ts
declare function stop(symbol: string): Promise<void>;
```

Stops the strategy from generating new signals.

Sets internal flag to prevent strategy from opening new signals.
Current active signal (if any) will complete normally.
Backtest/Live mode will stop at the next safe point (idle state or after signal closes).

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
