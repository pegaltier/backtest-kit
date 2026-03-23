---
title: docs/function/hasNoScheduledSignal
group: docs
---

# hasNoScheduledSignal

```ts
declare function hasNoScheduledSignal(symbol: string): Promise<boolean>;
```

Returns true if there is NO active scheduled signal for the given symbol.

Inverse of hasScheduledSignal. Use to guard signal generation logic.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
