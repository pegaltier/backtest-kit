---
title: docs/api-reference/function/listenOptimizerProgress
group: docs
---

# listenOptimizerProgress

```ts
declare function listenOptimizerProgress(fn: (event: ProgressOptimizerContract) => void): () => void;
```

Subscribes to optimizer progress events with queued async processing.

Emits during optimizer execution to track data source processing progress.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle optimizer progress events |
