---
title: docs/api-reference/class/PartialGlobalService
group: docs
---

# PartialGlobalService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### partialConnectionService

```ts
partialConnectionService: any
```

### profit

```ts
profit: (symbol: string, data: ISignalRow, currentPrice: number, revenuePercent: number, backtest: boolean, when: Date) => Promise<void>
```

### loss

```ts
loss: (symbol: string, data: ISignalRow, currentPrice: number, lossPercent: number, backtest: boolean, when: Date) => Promise<void>
```

### clear

```ts
clear: (symbol: string, data: ISignalRow, priceClose: number) => Promise<void>
```
