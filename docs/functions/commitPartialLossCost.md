---
title: docs/function/commitPartialLossCost
group: docs
---

# commitPartialLossCost

```ts
declare function commitPartialLossCost(symbol: string, dollarAmount: number): Promise<boolean>;
```

Executes partial close at loss level by absolute dollar amount (moving toward SL).

Convenience wrapper around commitPartialLoss that converts a dollar amount
to a percentage of the invested position cost automatically.
Price must be moving toward stop loss (in loss direction).

Automatically detects backtest/live mode from execution context.
Automatically fetches current price via getAveragePrice.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
| `dollarAmount` | Dollar value of position to close (e.g. 100 closes $100 worth) |
