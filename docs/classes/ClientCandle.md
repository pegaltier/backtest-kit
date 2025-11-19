---
title: docs/api-reference/class/ClientCandle
group: docs
---

# ClientCandle

Implements `ICandle`

## Constructor

```ts
constructor(params: ICandleParams);
```

## Properties

### params

```ts
params: ICandleParams
```

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, limit: number) => Promise<ICandleData[]>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string) => Promise<number>
```
