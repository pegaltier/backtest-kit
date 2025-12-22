---
title: docs/function/hasTradeContext
group: docs
---

# hasTradeContext

```ts
declare function hasTradeContext(): boolean;
```

Checks if trade context is active (execution and method contexts).

Returns true when both contexts are active, which is required for calling
exchange functions like getCandles, getAveragePrice, formatPrice, formatQuantity,
getDate, and getMode.
