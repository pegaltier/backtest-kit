---
title: docs/api-reference/interface/IExchange
group: docs
---

# IExchange

## Properties

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, limit: number) => Promise<ICandleData[]>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string) => Promise<number>
```
