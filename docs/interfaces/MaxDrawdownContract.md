---
title: docs/interface/MaxDrawdownContract
group: docs
---

# MaxDrawdownContract

## Properties

### symbol

```ts
symbol: string
```

Trading symbol (e.g. "BTC/USDT")

### currentPrice

```ts
currentPrice: number
```

Current price at the time of the max drawdown update

### timestamp

```ts
timestamp: number
```

Timestamp of the max drawdown update (milliseconds since epoch)

### strategyName

```ts
strategyName: string
```

Strategy name for context

### exchangeName

```ts
exchangeName: string
```

Exchange name for context

### frameName

```ts
frameName: string
```

Frame name for context (e.g. "1m", "5m")

### signal

```ts
signal: IPublicSignalRow
```

Public signal data for the position associated with this max drawdown update

### backtest

```ts
backtest: boolean
```

Indicates if the update is from a backtest or live trading (true for backtest, false for live)
