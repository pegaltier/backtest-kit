---
title: docs/function/listenExit
group: docs
---

# listenExit

```ts
declare function listenExit(fn: (error: Error) => void): () => void;
```

Subscribes to fatal execution errors with queued async processing.

Listens to critical errors that terminate execution (Live.background, Backtest.background, Walker.background).
Unlike listenError (recoverable errors), these errors stop the current process.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle fatal error events |
