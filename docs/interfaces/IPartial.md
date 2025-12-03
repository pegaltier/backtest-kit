---
title: docs/api-reference/interface/IPartial
group: docs
---

# IPartial

## Methods

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
