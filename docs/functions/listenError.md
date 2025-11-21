---
title: docs/api-reference/function/listenError
group: docs
---

# listenError

```ts
declare function listenError(fn: (error: Error) => void): () => void;
```

Subscribes to background execution errors with queued async processing.

Listens to errors caught in Live.background() and Backtest.background() execution.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle error events |
