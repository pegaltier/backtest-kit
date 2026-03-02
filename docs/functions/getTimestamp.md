---
title: docs/function/getTimestamp
group: docs
---

# getTimestamp

```ts
declare function getTimestamp(): Promise<number>;
```

Gets the current timestamp from execution context.

In backtest mode: returns the current timeframe timestamp being processed
In live mode: returns current real-time timestamp
