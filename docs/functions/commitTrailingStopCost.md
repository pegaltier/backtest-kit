---
title: docs/function/commitTrailingStopCost
group: docs
---

# commitTrailingStopCost

```ts
declare function commitTrailingStopCost(symbol: string, newStopLossPrice: number): Promise<boolean>;
```

Adjusts the trailing stop-loss to an absolute price level.

Convenience wrapper around commitTrailingStop that converts an absolute
stop-loss price to a percentShift relative to the ORIGINAL SL distance.

Automatically detects backtest/live mode from execution context.
Automatically fetches current price via getAveragePrice.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
| `newStopLossPrice` | Desired absolute stop-loss price |
