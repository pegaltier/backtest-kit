---
title: docs/interface/ICandleData
group: docs
---

# ICandleData

Single OHLCV candle data point.
Used for VWAP calculation and backtesting.

## Properties

### timestamp

```ts
timestamp: number
```

Unix timestamp in milliseconds when candle opened

### open

```ts
open: number
```

Opening price at candle start

### high

```ts
high: number
```

Highest price during candle period

### low

```ts
low: number
```

Lowest price during candle period

### close

```ts
close: number
```

Closing price at candle end

### volume

```ts
volume: number
```

Trading volume during candle period
