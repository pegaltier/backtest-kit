---
title: docs/function/listenPerformance
group: docs
---

# listenPerformance

```ts
declare function listenPerformance(fn: (event: PerformanceContract) => void): () => void;
```

Subscribes to performance metric events with queued async processing.

Emits during strategy execution to track timing metrics for operations.
Useful for profiling and identifying performance bottlenecks.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle performance events |
