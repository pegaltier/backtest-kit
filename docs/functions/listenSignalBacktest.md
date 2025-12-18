---
title: docs/function/listenSignalBacktest
group: docs
---

# listenSignalBacktest

```ts
declare function listenSignalBacktest(fn: (event: IStrategyTickResult) => void): () => void;
```

Subscribes to backtest signal events with queued async processing.

Only receives events from Backtest.run() execution.
Events are processed sequentially in order received.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle backtest signal events |
