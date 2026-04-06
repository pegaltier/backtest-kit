---
title: docs/function/getPositionMaxDrawdownPnlCost
group: docs
---

# getPositionMaxDrawdownPnlCost

```ts
declare function getPositionMaxDrawdownPnlCost(symbol: string): Promise<number>;
```

Returns the PnL cost (in quote currency) at the moment the worst loss price was recorded during this position's life.

Returns null if no pending signal exists.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
