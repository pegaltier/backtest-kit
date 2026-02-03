---
title: docs/interface/SignalCommitBase
group: docs
---

# SignalCommitBase

Base fields for all signal commit events.

## Properties

### symbol

```ts
symbol: string
```

Trading pair symbol (e.g., "BTCUSDT")

### strategyName

```ts
strategyName: string
```

Strategy name that generated this signal

### exchangeName

```ts
exchangeName: string
```

Exchange name where signal was executed

### frameName

```ts
frameName: string
```

Timeframe name (used in backtest mode, empty string in live mode)

### backtest

```ts
backtest: boolean
```

Whether this event is from backtest mode (true) or live mode (false)

### signalId

```ts
signalId: string
```

Unique signal identifier (UUID v4)

### timestamp

```ts
timestamp: number
```

Timestamp from execution context (tick's when or backtest candle timestamp)
