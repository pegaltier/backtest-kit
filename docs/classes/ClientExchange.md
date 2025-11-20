---
title: docs/api-reference/class/ClientExchange
group: docs
---

# ClientExchange

Implements `IExchange`

## Constructor

```ts
constructor(params: IExchangeParams);
```

## Properties

### params

```ts
params: IExchangeParams
```

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, limit: number) => Promise<ICandleData[]>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string) => Promise<number>
```
