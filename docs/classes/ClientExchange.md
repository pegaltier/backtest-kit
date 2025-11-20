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

## Methods

### getCandles

```ts
getCandles(symbol: string, interval: CandleInterval, limit: number): Promise<ICandleData[]>;
```

### getNextCandles

```ts
getNextCandles(symbol: string, interval: CandleInterval, limit: number): Promise<ICandleData[]>;
```

### getAveragePrice

```ts
getAveragePrice(symbol: string): Promise<number>;
```

### formatQuantity

```ts
formatQuantity(symbol: string, quantity: number): Promise<string>;
```

### formatPrice

```ts
formatPrice(symbol: string, price: number): Promise<string>;
```
