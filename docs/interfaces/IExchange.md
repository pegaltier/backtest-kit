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

### getNextCandles

```ts
getNextCandles: (symbol: string, interval: CandleInterval, limit: number) => Promise<ICandleData[]>
```

### formatQuantity

```ts
formatQuantity: (symbol: string, quantity: number) => Promise<string>
```

### formatPrice

```ts
formatPrice: (symbol: string, price: number) => Promise<string>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string) => Promise<number>
```
