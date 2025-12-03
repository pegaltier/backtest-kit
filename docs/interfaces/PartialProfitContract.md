---
title: docs/api-reference/interface/PartialProfitContract
group: docs
---

# PartialProfitContract

Contract for partial profit level events.

Emitted when a signal reaches a profit level milestone (10%, 20%, etc).
Used for tracking partial take-profit execution.

## Properties

### symbol

```ts
symbol: string
```

symbol - Trading symbol (e.g., "BTCUSDT")

### data

```ts
data: ISignalRow
```

data - Signal row data

### currentPrice

```ts
currentPrice: number
```

currentPrice - Current market price

### level

```ts
level: PartialLevel
```

level - Profit level reached (10, 20, 30, etc)

### backtest

```ts
backtest: boolean
```

backtest - True if backtest mode, false if live mode

### timestamp

```ts
timestamp: number
```

timestamp - Event timestamp in milliseconds (current time for live, candle time for backtest)
