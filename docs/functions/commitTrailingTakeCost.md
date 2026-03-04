---
title: docs/function/commitTrailingTakeCost
group: docs
---

# commitTrailingTakeCost

```ts
declare function commitTrailingTakeCost(symbol: string, newTakeProfitPrice: number): Promise<boolean>;
```

Adjusts the trailing take-profit to an absolute price level.

Convenience wrapper around commitTrailingTake that converts an absolute
take-profit price to a percentShift relative to the ORIGINAL TP distance.

Automatically detects backtest/live mode from execution context.
Automatically fetches current price via getAveragePrice.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
| `newTakeProfitPrice` | Desired absolute take-profit price |
