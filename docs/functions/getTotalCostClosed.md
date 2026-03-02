---
title: docs/function/getTotalCostClosed
group: docs
---

# getTotalCostClosed

```ts
declare function getTotalCostClosed(symbol: string): Promise<number>;
```

Returns the cost basis in dollars of the position currently held (not closed).
Correctly accounts for DCA entries between partial closes.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
