---
title: docs/function/getTotalPercentClosed
group: docs
---

# getTotalPercentClosed

```ts
declare function getTotalPercentClosed(symbol: string): Promise<number>;
```

Returns the percentage of the position currently held (not closed).
100 = nothing has been closed (full position), 0 = fully closed.
Correctly accounts for DCA entries between partial closes.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
