---
title: docs/function/hasNoPendingSignal
group: docs
---

# hasNoPendingSignal

```ts
declare function hasNoPendingSignal(symbol: string): Promise<boolean>;
```

Returns true if there is NO active pending signal for the given symbol.

Inverse of hasPendingSignal. Use to guard signal generation logic.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
