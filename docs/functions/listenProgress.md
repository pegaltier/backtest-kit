---
title: docs/api-reference/function/listenProgress
group: docs
---

# listenProgress

```ts
declare function listenProgress(fn: (event: ProgressContract) => void): () => void;
```

Subscribes to backtest progress events with queued async processing.

Emits during Backtest.background() execution to track progress.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle progress events |
