---
title: docs/function/listenSignal
group: docs
---

# listenSignal

```ts
declare function listenSignal(fn: (event: IStrategyTickResult) => void): () => void;
```

Subscribes to all signal events with queued async processing.

Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle signal events (idle, opened, active, closed) |
