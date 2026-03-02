---
title: docs/function/getScheduledSignal
group: docs
---

# getScheduledSignal

```ts
declare function getScheduledSignal(symbol: string): Promise<IScheduledSignalRow>;
```

Returns the currently active scheduled signal for the strategy.
If no scheduled signal exists, returns null.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
