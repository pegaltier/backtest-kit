---
title: docs/api-reference/class/CandlePublicService
group: docs
---

# CandlePublicService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### candleConnectionService

```ts
candleConnectionService: any
```

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, limit: number, when: Date, backtest: boolean) => Promise<ICandleData[]>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string, when: Date, backtest: boolean) => Promise<number>
```
