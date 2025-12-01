---
title: docs/api-reference/interface/ProgressBacktestContract
group: docs
---

# ProgressBacktestContract

Contract for backtest progress events.

Emitted during Backtest.background() execution to track progress.
Contains information about total frames, processed frames, and completion percentage.

## Properties

### exchangeName

```ts
exchangeName: string
```

exchangeName - Name of the exchange used in execution

### strategyName

```ts
strategyName: string
```

strategyName - Name of the strategy being executed

### symbol

```ts
symbol: string
```

symbol - Trading symbol (e.g., "BTCUSDT")

### totalFrames

```ts
totalFrames: number
```

totalFrames - Total number of frames to process

### processedFrames

```ts
processedFrames: number
```

processedFrames - Number of frames processed so far

### progress

```ts
progress: number
```

progress - Completion percentage from 0.0 to 1.0
