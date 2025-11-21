---
title: docs/api-reference/interface/IStrategyPnL
group: docs
---

# IStrategyPnL

Profit and loss calculation result.
Includes adjusted prices with fees (0.1%) and slippage (0.1%).

## Properties

### pnlPercentage

```ts
pnlPercentage: number
```

Profit/loss as percentage (e.g., 1.5 for +1.5%, -2.3 for -2.3%)

### priceOpen

```ts
priceOpen: number
```

Entry price adjusted with slippage and fees

### priceClose

```ts
priceClose: number
```

Exit price adjusted with slippage and fees
