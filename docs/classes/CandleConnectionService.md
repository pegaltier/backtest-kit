---
title: docs/api-reference/class/CandleConnectionService
group: docs
---

# CandleConnectionService

Implements `ICandle`

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### executionContextService

```ts
executionContextService: any
```

### candleSchemaService

```ts
candleSchemaService: any
```

### getCandle

```ts
getCandle: ((symbol: string) => ClientCandle) & IClearableMemoize<string> & IControlMemoize<string, ClientCandle>
```

### getCandles

```ts
getCandles: (symbol: string, interval: CandleInterval, limit: number) => Promise<ICandleData[]>
```

### getAveragePrice

```ts
getAveragePrice: (symbol: string) => Promise<number>
```
