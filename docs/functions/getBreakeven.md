---
title: docs/function/getBreakeven
group: docs
---

# getBreakeven

```ts
declare function getBreakeven(symbol: string, currentPrice: number): Promise<boolean>;
```

Checks if breakeven threshold has been reached for the current pending signal.

Returns true if price has moved far enough in profit direction to cover
transaction costs. Threshold is calculated as: (CC_PERCENT_SLIPPAGE + CC_PERCENT_FEE) * 2

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
| `currentPrice` | Current market price to check against threshold |
