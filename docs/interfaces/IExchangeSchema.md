---
title: docs/api-reference/interface/IExchangeSchema
group: docs
---

# IExchangeSchema

## Properties

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, since: Date, limit: number) => Promise<ICandleData[]>
```

### callbacks

```ts
callbacks: Partial<IExchangeCallbacks>
```
