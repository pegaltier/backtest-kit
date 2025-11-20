---
title: docs/api-reference/class/ExchangePublicService
group: docs
---

# ExchangePublicService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### exchangeConnectionService

```ts
exchangeConnectionService: any
```

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, limit: number, when: Date, backtest: boolean) => Promise<ICandleData[]>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string, when: Date, backtest: boolean) => Promise<number>
```

### formatPrice

```ts
formatPrice: (symbol: string, price: number, when: Date, backtest: boolean) => Promise<string>
```

### formatQuantity

```ts
formatQuantity: (symbol: string, quantity: number, when: Date, backtest: boolean) => Promise<string>
```
