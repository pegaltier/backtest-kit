---
title: docs/api-reference/interface/ICandleSchema
group: docs
---

# ICandleSchema

## Properties

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, since: Date, limit: number) => Promise<ICandleData[]>
```

### callbacks

```ts
callbacks: Partial<ICandleCallbacks>
```
